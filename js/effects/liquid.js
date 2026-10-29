// 07 · Liquid
//
// Hover a look and the card is a liquid glass that you draw in with the
// pointer. A blob of it gathers where the pointer comes in and follows it
// with a gooey lag, its tail stretching behind. Through it the photograph is
// frosted under the card's light veil and type, and near its rim, where the
// surface curves, the picture and the type bend as through a lens, with a
// glint where the light catches it. Flick the pointer and drops break away,
// fly a little and are pulled back, merging with a stretchy neck. The glass
// gathers as you hover, faster the more you move, until it floods the look
// and settles flat into a pane of frosted glass with the card on it.
//
// Leave and it drains back into a drop and is gone. Come back before it's
// gone and it gathers again.

import { paint } from '../card.js';
import { fullscreen, overlay, program, texture, uniforms } from '../gl.js';
import { locate, motion } from '../wipe.js';

const CONFIG = {
  size: 0.14, // the blob's radius when it gathers, as a share of the look's width
  tail: 3, // drops in its tail
  stiffness: 60, // how hard the blob is pulled after the pointer
  damping: 11, // how quickly its wobble dies down
  flick: 900, // CSS pixels a second the pointer must move for drops to break away
  gather: 1.2, // how fast the liquid gathers while you hover, keeping still (it floods at 1)
  flow: 0.0012, // how much more it gathers for every CSS pixel a second you move
  flood: 1, // seconds for it to flood the look
  drain: 0.6, // seconds for it to drain away when you leave
  gloss: 0.1, // how bright its highlight is, 0 to 1
  lens: 30, // how far its curved surface bends the picture near the rim, in CSS pixels
  frost: [0, 5], // how far it blurs the photograph, in CSS pixels: as a blob, and once it has flooded (the veil's colour is the card's, in the CSS)
  shadow: 0.05, // how dark the shadow just outside the blob is, 0 for none
};

// The most drops the shader looks at: the blob, its tail and the loose ones.
const MAX = 16;

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uPhoto; // the photograph, mipmapped
uniform sampler2D uCard; // the card, painted from the page: its see-through veil and its type
uniform vec2 uResolution;
uniform float uPixel; // canvas pixels to a CSS pixel
uniform vec3 uDrops[${MAX}]; // each drop's centre and radius, in CSS pixels, y up
uniform int uCount;
uniform float uSettle; // 1 once the liquid has flooded the look and lies flat
uniform float uGloss;
uniform float uLens;
uniform float uShadow;
uniform vec2 uFrost;
uniform float uTexels; // the photograph's pixels to a CSS pixel

out vec4 color;

// The photograph frosted r CSS pixels wide at p: the average of a ring of
// points around it, each read from a mip level blurred about half as wide
// (each level is half as sharp as the one before), so the ring fills in.
vec3 frosted(vec2 p, vec2 size, float r) {
  float lod = max(0.0, log2(r * uTexels) - 1.0);
  vec3 c = textureLod(uPhoto, p / size, lod).rgb;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.7854;
    c += textureLod(uPhoto, (p + r * vec2(cos(a), sin(a))) / size, lod).rgb;
  }
  return c / 9.0;
}

void main() {
  vec2 p = gl_FragCoord.xy / uPixel;
  vec2 size = uResolution / uPixel;

  // How much liquid there is here: each drop adds r² / d², so drops that
  // come close bulge towards each other and merge with a neck. Above 1 is
  // liquid.
  float field = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec2 d = p - uDrops[i].xy;
    field += uDrops[i].z * uDrops[i].z / (dot(d, d) + 1.0);
  }
  float w = max(fwidth(field), 1e-4);
  float inside = smoothstep(1.0 - w, 1.0 + w, field);

  // Its surface: flat in the deep middle, curving down to the rim.
  float height = 1.0 - exp(-(field - 1.0) * 1.5);
  vec2 slope = vec2(dFdx(height), dFdy(height)) * uPixel; // per CSS pixel
  vec3 normal = normalize(vec3(-slope * 24.0 * (1.0 - uSettle), 1.0));

  // Through the glass: the photograph under the card's veil and type, all
  // bent near the rim where the surface curves, with a highlight from the
  // upper left. Clear as a blob, it frosts as it floods.
  vec2 seen = p + normal.xy * uLens * (1.0 - clamp(height, 0.0, 1.0));
  vec4 card = texture(uCard, clamp(seen / size, 0.0, 1.0));
  vec3 glass = mix(frosted(seen, size, mix(uFrost.x, uFrost.y, uSettle)), card.rgb, card.a);
  vec3 light = normalize(vec3(-0.5, 0.6, 0.65));
  float spec = pow(max(dot(normal, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 60.0);
  glass += uGloss * spec * (1.0 - uSettle);

  // A faint shadow on the photograph just outside it.
  float shadow = uShadow * smoothstep(0.55, 1.0, field) * (1.0 - inside) * (1.0 - uSettle);

  color = vec4(glass, 1.0) * inside + vec4(0.0, 0.0, 0.0, shadow);
}`;

function liquid(look) {
  const img = look.querySelector('.look__img');
  const card = look.querySelector('.look__card');

  const gl = overlay(look);
  const prog = program(gl, fullscreen, fragment);
  gl.useProgram(prog);
  const u = uniforms(gl, prog);
  texture(gl, 0, img, { mipmaps: true });
  const paper = document.createElement('canvas');
  const cardTexture = gl.createTexture();
  gl.uniform1i(u.uPhoto, 0);
  gl.uniform1i(u.uCard, 1);
  gl.uniform1f(u.uGloss, CONFIG.gloss);
  gl.uniform1f(u.uLens, CONFIG.lens);
  gl.uniform1f(u.uShadow, CONFIG.shadow);
  gl.uniform2f(u.uFrost, ...CONFIG.frost);

  let size = { width: 1, height: 1 };
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, t: 0 }; // CSS pixels, y up, and its speed
  const head = { x: 0, y: 0, vx: 0, vy: 0 }; // the blob, pulled after the pointer
  let tail = []; // drops trailing the blob, each after the one before
  let loose = []; // drops flicked off, pulled back to the blob
  let gathered = 0; // how much liquid has gathered, 0 to 1 (it floods at 1)
  let hovering = false;
  let cooldown = 0;
  const state = { presence: 0, flood: 0 }; // how much of the liquid is there (draining, 0), and how far it has flooded

  const drops = new Float32Array(MAX * 3);
  const draw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.presence === 0) return;
    const base = CONFIG.size * size.width * Math.sqrt(0.35 + gathered);
    // Flooding, the blob grows until it covers the look's farthest corner.
    const corner = Math.max(
      Math.hypot(head.x, head.y),
      Math.hypot(size.width - head.x, head.y),
      Math.hypot(head.x, size.height - head.y),
      Math.hypot(size.width - head.x, size.height - head.y),
    );
    const flood = gsap.parseEase('power2.inOut')(state.flood);
    const r = gsap.utils.interpolate(base, corner * 1.6 + 20, flood) * state.presence;
    let n = 0;
    const add = (x, y, radius) => {
      if (n >= MAX || radius <= 0.5) return;
      drops.set([x, y, radius], n * 3);
      n++;
    };
    add(head.x, head.y, r);
    tail.forEach((t, i) => add(t.x, t.y, base * 0.72 ** (i + 1) * state.presence * (1 - flood)));
    loose.forEach((d) => add(d.x, d.y, d.r * state.presence));
    gl.uniform3fv(u.uDrops, drops);
    gl.uniform1i(u.uCount, n);
    gl.uniform1f(u.uSettle, flood * state.presence); // flattening as it floods, and curving again as it drains
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Floods the look once enough has gathered.
  let flooding = null;
  const floodIt = () => {
    flooding = gsap.to(state, { flood: 1, duration: CONFIG.flood * motion, ease: 'none' });
  };

  // Every frame while the liquid moves.
  let ticking = false;
  const tick = (time, deltaTime) => {
    const dt = Math.min(deltaTime / 1000, 1 / 30);

    // The blob, sprung after the pointer, flooding included: the flood
    // spreads from wherever the blob has flowed to.
    head.vx += (pointer.x - head.x) * CONFIG.stiffness * dt;
    head.vy += (pointer.y - head.y) * CONFIG.stiffness * dt;
    const keep = Math.exp(-CONFIG.damping * dt);
    head.vx *= keep;
    head.vy *= keep;
    head.x += head.vx * dt;
    head.y += head.vy * dt;
    tail.forEach((t, i) => {
      const lead = i ? tail[i - 1] : head;
      const k = 1 - Math.exp(-dt / (0.035 * (i + 1)));
      t.x += (lead.x - t.x) * k;
      t.y += (lead.y - t.y) * k;
    });

    // Flicks throw drops off the blob; they're pulled back and merge again.
    const speed = Math.hypot(pointer.vx, pointer.vy);
    pointer.vx *= Math.exp(-dt / 0.08);
    pointer.vy *= Math.exp(-dt / 0.08);
    cooldown -= dt;
    const base = CONFIG.size * size.width * Math.sqrt(0.35 + gathered);
    if (
      hovering &&
      !flooding &&
      speed > CONFIG.flick &&
      cooldown <= 0 &&
      loose.length < MAX - 1 - CONFIG.tail
    ) {
      cooldown = 0.06;
      const angle = Math.atan2(pointer.vy, pointer.vx) + gsap.utils.random(-0.5, 0.5);
      loose.push({
        x: head.x + Math.cos(angle) * base * 0.6,
        y: head.y + Math.sin(angle) * base * 0.6,
        vx: pointer.vx * 0.6 + gsap.utils.random(-120, 120),
        vy: pointer.vy * 0.6 + gsap.utils.random(-120, 120),
        r: base * gsap.utils.random(0.22, 0.38),
      });
    }
    loose = loose.filter((d) => {
      d.vx += (head.x - d.x) * 26 * dt;
      d.vy += (head.y - d.y) * 26 * dt;
      const keep = Math.exp(-4 * dt);
      d.vx *= keep;
      d.vy *= keep;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      return Math.hypot(head.x - d.x, head.y - d.y) > base * 0.35;
    });

    // It gathers while you hover, more as you move, and floods at 1.
    if (hovering && !flooding) {
      gathered = Math.min(1, gathered + dt * (CONFIG.gather + CONFIG.flow * speed));
      if (gathered >= 1) floodIt();
    }

    draw();
    const still = Math.hypot(head.vx, head.vy) < 2 && !loose.length;
    const done = hovering ? state.flood === 1 : state.presence === 0;
    if (done && still && !gsap.isTweening(state)) {
      gsap.ticker.remove(tick);
      ticking = false;
    }
  };
  const run = () => {
    if (ticking) return;
    ticking = true;
    gsap.ticker.add(tick);
  };

  const aim = (e) => {
    const { x, y } = locate(look, e);
    const px = x * size.width;
    const py = (1 - y) * size.height; // y runs down the page but up the canvas
    const dt = Math.max((e.timeStamp - pointer.t) / 1000, 0.008);
    if (pointer.t) {
      pointer.vx = (px - pointer.x) / dt;
      pointer.vy = (py - pointer.y) / dt;
    }
    pointer.x = px;
    pointer.y = py;
    pointer.t = e.timeStamp;
  };

  const enter = (e) => {
    hovering = true;
    pointer.t = 0;
    aim(e);
    // A fresh blob gathers right where the pointer comes in.
    if (state.presence === 0) {
      Object.assign(head, { x: pointer.x, y: pointer.y, vx: 0, vy: 0 });
      tail = Array.from({ length: CONFIG.tail }, () => ({ x: pointer.x, y: pointer.y }));
      loose = [];
      gathered = 0;
      gsap.killTweensOf(state, 'flood');
      state.flood = 0;
      flooding = null;
    }
    if (!motion) {
      state.presence = 1;
      state.flood = 1;
      flooding = true;
      draw();
      return;
    }
    gsap.to(state, { presence: 1, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    run();
  };

  const leave = () => {
    hovering = false;
    if (!motion) {
      state.presence = 0;
      draw();
      return;
    }
    gsap.to(state, { presence: 0, duration: CONFIG.drain, ease: 'power2.in', overwrite: 'auto' });
    run();
  };

  look.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && enter(e));
  // Once the look has flooded, the blob's place no longer shows.
  look.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !hovering) return;
    aim(e);
    if (state.flood < 1) run();
  });
  look.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && leave());

  // Touch has no hover: a tap gathers the liquid where it lands until it
  // floods, and the next one drains it.
  look.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    if (hovering) leave();
    else enter(e);
  });

  new ResizeObserver(() => {
    const { width, height } = look.getBoundingClientRect();
    size = { width, height };
    const dpr = Math.min(devicePixelRatio, 2);
    gl.canvas.width = Math.round(width * dpr);
    gl.canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(u.uResolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(u.uPixel, gl.canvas.width / width);
    gl.uniform1f(u.uTexels, img.naturalWidth / width);
    paint(paper, card, look, gl.canvas.width / width);
    texture(gl, 1, paper, { tex: cardTexture });
    draw();
  }).observe(look);
}

export default function liquidCard(looks) {
  looks.forEach(liquid);
}
