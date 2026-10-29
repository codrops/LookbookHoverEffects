// 06 · Melt
//
// Hover a look and the pointer is a source of heat. Around it the
// photograph softens like a warm plastic film: it sags under its own weight,
// stretching downwards and thinning, and where it's stretched too thin it
// tears open in holes with soft, glossy rims, and the card shows through.
// Darker parts take the heat sooner. The heat spreads from the pointer and
// follows it as it moves, and before long the whole film has given way.
//
// Leave and the film cools and pulls itself back together, the holes
// closing and the sag lifting, the last to melt the first to recover.

import { paint } from '../card.js';
import { field, fullscreen, overlay, program, texture, uniforms } from '../gl.js';
import { tones } from '../photo.js';
import { locate, motion } from '../wipe.js';

const CONFIG = {
  heat: 30, // how fast the pointer heats the film around it
  reach: 0.2, // how far around the pointer it heats, as a share of the look's width
  spread: 0.2, // how fast the heat spreads through the film, 0 to 0.25
  soften: 15, // how fast the heat melts the film
  warm: [0.8, 1.6], // after how many seconds of hovering the whole film starts to melt, and is gone
  cool: 2, // how fast the film recovers once the pointer leaves
  sag: 0.3, // how far the film sags at the most, as a share of the look
  dark: 0, // how much sooner the darker parts melt, 0 for not at all
};

// The grid the heat and the melting are worked out on, 4:5 like the looks.
const COLS = 48;
const ROWS = 60;
const MOLTEN = 3; // the most a cell can melt; it tears at 1, and at this even its toughest grain has torn

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uPhoto; // the photograph
uniform sampler2D uCard; // the card, painted from the page
uniform sampler2D uMelt; // r: how far the film has melted there, 0 to 3 (it tears at 1); g: how far it has sagged: how much it has stretched above, added up, 0 to 1
uniform vec2 uResolution;
uniform float uSag;

out vec4 color;

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(random(i), random(i + vec2(1.0, 0.0)), f.x), mix(random(i + vec2(0.0, 1.0)), random(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Where the film seen here hung before it sagged: higher up, by how much
  // has melted above it (found by stepping back twice).
  vec2 from = uv;
  from.y = uv.y + uSag * texture(uMelt, from).g;
  from.y = uv.y + uSag * texture(uMelt, from).g;
  from.y = min(from.y, 1.0);

  // How far the film there has melted, roughened by its own grain so it
  // tears first in many small holes that grow and run together, drawn out
  // downwards into strands as it droops, and that travel down with it as it
  // sags.
  float grain = 0.5 * noise(from * vec2(10.0, 4.0)) + 0.3 * noise(from * vec2(26.0, 9.0)) + 0.2 * noise(from * vec2(60.0, 22.0));
  float melted = texture(uMelt, from).r * mix(0.35, 1.65, grain);
  float w = max(fwidth(melted), 1e-4);
  float film = 1.0 - smoothstep(1.0 - w, 1.0 + w, melted); // 1 where the film still holds

  // Just before it tears the film gathers into a darker, rounded rim that
  // catches the light, and lets a little of the card through.
  vec3 photo = texture(uPhoto, from).rgb;
  vec3 card = texture(uCard, uv).rgb;
  float rim = smoothstep(0.75, 1.0, melted);
  vec3 skin = mix(photo, card, 0.15 * rim) * mix(1.0, 0.62, rim);
  vec3 n = normalize(vec3(-dFdx(melted), -dFdy(melted), 0.06));
  float shine = rim * pow(max(dot(n, normalize(vec3(-0.5, 0.7, 0.5))), 0.0), 5.0);
  skin += shine * 0.9;

  color = vec4(mix(card, skin, film), 1.0);
}`;

function melt(look) {
  const img = look.querySelector('.look__img');
  const card = look.querySelector('.look__card');

  const gl = overlay(look);
  const prog = program(gl, fullscreen, fragment);
  gl.useProgram(prog);
  const u = uniforms(gl, prog);
  texture(gl, 0, img, { mipmaps: true });
  const paper = document.createElement('canvas');
  const cardTexture = gl.createTexture();
  const meltTexture = gl.createTexture();
  gl.uniform1i(u.uPhoto, 0);
  gl.uniform1i(u.uCard, 1);
  gl.uniform1i(u.uMelt, 2);
  gl.uniform1f(u.uSag, CONFIG.sag);

  // How readily each cell melts: the darker the photograph there, the sooner.
  const { data: tone } = tones(img, COLS);
  const absorb = Float32Array.from(
    { length: COLS * ROWS },
    (_, i) => 1 + CONFIG.dark * (0.5 - tone[Math.min(i, tone.length - 1)]),
  );

  // The heat and how far each cell has melted, rows bottom to top, and what
  // goes up to the shader: each cell's melt and its sag.
  let heat = new Float32Array(COLS * ROWS);
  let next = new Float32Array(COLS * ROWS);
  const melted = new Float32Array(COLS * ROWS);
  const upload = new Float32Array(COLS * ROWS * 2);

  const pointer = { x: 0.5, y: 0.5 }; // where the heat is, 0 to 1 across and up
  let hovering = false;
  let hovered = 0; // seconds since the pointer came in

  const draw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!melted.some((m) => m > 0)) return;
    for (let x = 0; x < COLS; x++) {
      let above = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        const i = y * COLS + x;
        above += (melted[i] / MOLTEN) ** 2 / ROWS; // the more molten, the more it stretches
        upload[i * 2] = melted[i];
        upload[i * 2 + 1] = above;
      }
    }
    field(gl, 2, { data: upload, w: COLS, h: ROWS }, { channels: 2, tex: meltTexture });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Every frame while the film is melting or recovering.
  let ticking = false;
  const tick = (time, deltaTime) => {
    const dt = Math.min(deltaTime / 1000, 0.05);
    let busy = false;

    if (hovering) {
      hovered += dt;
      const warm = gsap.utils.clamp(
        0,
        1,
        (hovered - CONFIG.warm[0]) / (CONFIG.warm[1] - CONFIG.warm[0]),
      );
      const r = CONFIG.reach * COLS;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          // The pointer's heat, spread to the neighbours, and the film
          // melting by it, faster where it's dark, and all over once it has
          // been warming long enough.
          const dx = x - pointer.x * (COLS - 1);
          const dy = y - pointer.y * (ROWS - 1);
          const left = heat[y * COLS + Math.max(x - 1, 0)];
          const right = heat[y * COLS + Math.min(x + 1, COLS - 1)];
          const down = heat[Math.max(y - 1, 0) * COLS + x];
          const up = heat[Math.min(y + 1, ROWS - 1) * COLS + x];
          next[i] =
            heat[i] +
            CONFIG.spread * (left + right + down + up - 4 * heat[i]) +
            CONFIG.heat * dt * Math.exp(-(dx * dx + dy * dy) / (r * r));
          melted[i] = Math.min(
            MOLTEN,
            melted[i] + dt * (CONFIG.soften * next[i] * absorb[i] + 2.5 * MOLTEN * warm * warm),
          );
          if (melted[i] < MOLTEN) busy = true;
        }
      }
      [heat, next] = [next, heat];
    } else {
      for (let i = 0; i < melted.length; i++) {
        heat[i] *= 0.9;
        melted[i] = Math.max(0, melted[i] - CONFIG.cool * dt);
        if (melted[i] > 0) busy = true;
      }
    }

    draw();
    if (!busy) {
      gsap.ticker.remove(tick);
      ticking = false;
    }
  };

  const run = () => {
    if (!motion) {
      melted.fill(hovering ? MOLTEN : 0);
      heat.fill(0);
      draw();
      return;
    }
    if (ticking) return;
    ticking = true;
    gsap.ticker.add(tick);
  };

  const aim = (e) => {
    const { x, y } = locate(look, e);
    pointer.x = x;
    pointer.y = 1 - y; // y runs down the page but up the grid
  };

  const enter = (e) => {
    hovering = true;
    hovered = 0;
    aim(e);
    run();
  };

  const leave = () => {
    hovering = false;
    run();
  };

  look.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && enter(e));
  look.addEventListener('pointermove', (e) => e.pointerType !== 'touch' && aim(e));
  look.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && leave());

  // Touch has no hover: a tap heats the film where it lands, and the next one
  // lets it cool.
  look.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    if (hovering) leave();
    else enter(e);
  });

  new ResizeObserver(() => {
    const { width, height } = look.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    gl.canvas.width = Math.round(width * dpr);
    gl.canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(u.uResolution, gl.canvas.width, gl.canvas.height);
    paint(paper, card, look, gl.canvas.width / width);
    texture(gl, 1, paper, { tex: cardTexture });
    draw();
  }).observe(look);
}

export default function melting(looks) {
  looks.forEach(melt);
}
