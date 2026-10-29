// 04 · Lift
//
// Hover a look and, instead of a card wiping over the photograph, the
// photograph comes apart in its tones. Its lightest parts slide away to the
// far side first, as one cut-out, then its mid-tones, then its shadows,
// each cut along the jagged outline of its tones, and the card is
// underneath. Where a photograph has a pale background, the background goes
// first and the figure stands on the card for a moment.
//
// Leave by the far half and the photograph comes back in from the near
// side, light layers first; leave by the near half and its layers slide
// back the way they went, shadows first. Come back before it's whole and
// they turn round.

import { paint } from '../card.js';
import { field, fullscreen, overlay, program, texture, uniforms } from '../gl.js';
import { blur, tones } from '../photo.js';
import { inward, locate, motion, sweeps } from '../wipe.js';

const CONFIG = {
  duration: 1.4, // seconds for all three layers to slide across the look, one after another
  ease: 'power2.inOut', // each layer's
  stagger: 0.1, // how long after one layer the next sets off, as a share of the duration
  smooth: 6, // how smooth the layers' outlines are: the blur, in pixels of a 240-pixel-wide photograph, before it's cut
};

// How far a layer slides to be fully off the look, as a share of it.
const OFF = 1.02;

// Where the three layers are (lights, mid-tones, shadows) when the hover
// has run p of its way. From 0 to 1 they slide off to the far side, one
// after another; from 1 to 2 they come back in from the near side, in the
// same order. Run backwards from 1 to 0, they slide back the way they went,
// the last out the first back.
const ease = gsap.parseEase(CONFIG.ease);
const shifts = (p) =>
  [0, 1, 2].map((k) => {
    const own = (t) =>
      ease(gsap.utils.clamp(0, 1, (t - k * CONFIG.stagger) / (1 - 2 * CONFIG.stagger)));
    return p <= 1 ? OFF * own(p) : -OFF * (1 - own(p - 1));
  });

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uPhoto; // the photograph
uniform sampler2D uTones; // its tones, blurred, 0 to 1
uniform sampler2D uCard; // the card, painted from the page
uniform vec2 uResolution;
uniform vec3 uSweep; // d = dot(uv, uSweep.xy) + uSweep.z: 0 on the side the pointer came in by, 1 on the far side
uniform vec3 uShift; // how far the lights, the mid-tones and the shadows have slid towards the far side, as a share of the look (below 0: still to come in from the near side)
uniform vec2 uCuts; // the tones where the layers divide: shadows below x, lights above y

out vec4 color;

// How much of the photograph at uv belongs to a layer: tones from lo to
// hi, cut smoothly. Each layer reaches a little way under the one above it
// (lights over mid-tones over shadows), so no thread of card shows along
// the cuts while the layers are in place.
float layer(vec2 uv, float lo, float hi) {
  float t = texture(uTones, uv).r;
  float w = max(fwidth(t), 1e-5);
  return smoothstep(lo - w, lo + w, t) * (1.0 - smoothstep(hi + w, hi + 3.0 * w, t));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 lo = vec3(uCuts.y, uCuts.x, -1.0);
  vec3 hi = vec3(2.0, uCuts.y, uCuts.x);

  // Lights on top, then mid-tones, then shadows, then the card: each layer
  // shows the photograph from where it was before it slid.
  vec4 c = vec4(0.0);
  for (int k = 0; k < 3; k++) {
    vec2 src = uv - uShift[k] * uSweep.xy;
    float inside = step(0.0, src.x) * step(src.x, 1.0) * step(0.0, src.y) * step(src.y, 1.0);
    float m = layer(src, lo[k], hi[k]) * inside;
    c += (1.0 - c.a) * vec4(texture(uPhoto, src).rgb, 1.0) * m;
  }
  color = c + (1.0 - c.a) * vec4(texture(uCard, uv).rgb, 1.0);
}`;

function lift(look) {
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
  gl.uniform1i(u.uTones, 1);
  gl.uniform1i(u.uCard, 2);

  // The photograph's tones, blurred so the layers' outlines are smooth, and
  // cut in three so each layer holds about a third of the photograph.
  const { data, w, h } = tones(img, 240);
  const smooth = blur(data, w, h, CONFIG.smooth);
  field(gl, 1, { data: smooth, w, h });
  const sorted = smooth.slice().sort();
  gl.uniform2f(
    u.uCuts,
    sorted[Math.floor(sorted.length / 3)],
    sorted[Math.floor((sorted.length * 2) / 3)],
  );

  // How far the hover has run, 0 to 2 (see shifts()).
  const state = { p: 0 };
  let from = null; // the side the pointer came in by, while the photograph is apart
  let shown = false; // whether the photograph is on its way out (true) or back

  // While the photograph is whole, the canvas is left clear and the page's
  // own image shows.
  const render = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.p === 0) return;
    gl.uniform3f(u.uShift, ...shifts(state.p));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Once the photograph is whole again, the next hover can take it apart
  // from any side.
  const rest = () => {
    if (state.p === 2) state.p = 0;
    if (state.p === 0) from = null;
    render();
  };

  // Runs the hover on to p, at the same pace whichever way and however far.
  const run = (p) => {
    gsap.to(state, {
      p,
      duration: CONFIG.duration * Math.abs(p - state.p) * motion,
      ease: 'none',
      overwrite: true,
      onUpdate: render,
      onComplete: rest,
    });
  };

  const enter = (e) => {
    shown = true;
    if (!from) {
      from = locate(look, e).side;
      gl.uniform3f(u.uSweep, ...sweeps[from]);
    }
    run(1); // coming back in from the near side, they turn round and go out again
  };

  const leave = (e) => {
    shown = false;
    if (!from) return;
    // By the far half, on round and back in from the near side; by the
    // near half, back the way they went.
    run(state.p <= 1 && inward(locate(look, e), from) <= 0.5 ? 0 : 2);
  };

  look.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && enter(e));
  look.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && leave(e));

  // Touch has no hover: a tap takes the photograph apart, and the next one
  // brings it back, from the side nearest the tap.
  look.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    if (shown) leave(e);
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
    texture(gl, 2, paper, { tex: cardTexture });
    render();
  }).observe(look);
}

export default function lifting(looks) {
  looks.forEach(lift);
}
