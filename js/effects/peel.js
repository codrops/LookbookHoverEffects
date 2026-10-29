// 05 · Peel
//
// Hover a look and the photograph peels back from the corner nearest the
// pointer, like a print lifted off a board. The fold runs straight across
// it and on over the whole look; the turned-back flap shows the back of
// the print, paper with the photograph faint and mirrored through it,
// lighter where it bends, and casts a soft shadow. The card is underneath,
// in the print's shade at first, brightening as more of it is uncovered.
//
// Leave and the print lays back down. Come back before it's down and it
// peels again. It peels the same way whichever side the pointer comes in
// by; only the corner changes.

import { paint } from '../card.js';
import { fullscreen, overlay, program, texture, uniforms } from '../gl.js';
import { locate, toggle } from '../wipe.js';

const CONFIG = {
  duration: 0.7, // seconds for the fold to cross the whole look
  ease: 'power1.inOut', // gathers pace as it lifts and slows as it comes off
  showThrough: 0.38, // how much of the photograph shows through the back of the print, 0 to 1
  shadow: 0.35, // how dark the flap's shadow is, 0 to 1
  shade: 0.6, // how dark the card is under the print as it starts to peel, 0 to 1; it brightens to nothing as it comes off
};

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uPhoto; // the photograph
uniform sampler2D uCard; // the card, painted from the page
uniform vec2 uResolution;
uniform float uPixel; // canvas pixels to a CSS pixel
uniform vec2 uCorner; // the corner the print peels from, in CSS pixels, y up
uniform vec2 uNormal; // from that corner into the look, at right angles to the fold
uniform float uFold; // how far the fold has come from the corner, in CSS pixels
uniform vec3 uPaper; // the colour of the back of the print
uniform float uShowThrough;
uniform float uShadow;
uniform float uShade; // how dark the uncovered card still is, 0 to 1

out vec4 color;

// How far a point is outside a box from (0, 0) to size: below 0 inside it.
float box(vec2 p, vec2 size) {
  vec2 q = abs(p - 0.5 * size) - 0.5 * size;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

void main() {
  vec2 size = uResolution / uPixel;
  vec2 p = gl_FragCoord.xy / uPixel; // CSS pixels
  float aa = 0.75 / uPixel;

  // Past the fold (t below 0) the print has been turned back. The flap is
  // that part folded over: at a point beyond the fold, it shows the spot
  // that was mirrored across the fold, where that spot is part of the print.
  float t = dot(p - uCorner, uNormal) - uFold;
  vec2 was = p - 2.0 * t * uNormal;
  float outside = box(was, size);
  float turned = 1.0 - smoothstep(-aa, aa, t);
  float flap = smoothstep(-aa, aa, t) * (1.0 - smoothstep(-aa, aa, outside));

  // The card where the print has gone, still in the print's shade, more so
  // near the fold.
  vec3 card = texture(uCard, p / size).rgb * (1.0 - uShade) * (1.0 - 0.3 * (1.0 - smoothstep(0.0, 40.0, -t)));

  // The back of the print: paper, the photograph faint through it, lighter
  // where it bends at the fold.
  vec3 through = texture(uPhoto, was / size).rgb;
  vec3 back = mix(uPaper, through, uShowThrough) * mix(1.04, 0.88, smoothstep(0.0, 0.6 * size.x, t));

  // The flap's soft shadow on the photograph around it.
  float shadow = uShadow * (1.0 - smoothstep(0.0, 22.0, outside)) * step(0.0, outside);

  vec4 under = vec4(card, 1.0) * turned + vec4(0.0, 0.0, 0.0, shadow) * (1.0 - turned);
  vec4 top = vec4(back, 1.0) * flap;
  color = top + under * (1.0 - top.a);
}`;

// A CSS colour as red, green and blue from 0 to 1.
const rgb = (css) =>
  css
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map((n) => n / 255);

function peel(look) {
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
  gl.uniform3f(u.uPaper, ...rgb(getComputedStyle(card).color));
  gl.uniform1f(u.uShowThrough, CONFIG.showThrough);
  gl.uniform1f(u.uShadow, CONFIG.shadow);

  // Which corner the print peels from (0 or 1 across and up, as a share of
  // the look), and the look's size in CSS pixels.
  const corner = { x: 0, y: 0 };
  let size = { width: 1, height: 1 };

  // While the print is down, the canvas is left clear and the page's own
  // image shows.
  const render = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.p === 0) return;
    // The fold sets off from the corner towards the middle of the look,
    // and is done once it has passed the far corner.
    const x = corner.x * size.width;
    const y = corner.y * size.height;
    const nx = size.width / 2 - x;
    const ny = size.height / 2 - y;
    const length = Math.hypot(nx, ny);
    gl.uniform2f(u.uCorner, x, y);
    gl.uniform2f(u.uNormal, nx / length, ny / length);
    gl.uniform1f(u.uFold, state.p * (2 * length + 2));
    gl.uniform1f(u.uShade, CONFIG.shade * (1 - state.p));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // How far the print has peeled, 0 to 1. It peels from the corner nearest
  // where the pointer (or a tap) came in.
  const state = toggle(look, {
    duration: CONFIG.duration,
    ease: CONFIG.ease,
    start: (e) => {
      const { x, y } = locate(look, e);
      corner.x = x < 0.5 ? 0 : 1;
      corner.y = y < 0.5 ? 1 : 0; // y runs down the page but up the canvas
    },
    update: render,
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
    paint(paper, card, look, gl.canvas.width / width);
    texture(gl, 1, paper, { tex: cardTexture });
    render();
  }).observe(look);
}

export default function peeling(looks) {
  looks.forEach(peel);
}
