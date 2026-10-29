// 02 · Glass
//
// Hover a look and a drop of liquid glass swells from its middle and, in one
// movement, spreads over the whole look, round at first and squaring off as
// it grows, wobbling a little as it goes. The glass has no frame of its own:
// you see it only by what it does to the picture. Through it is the card,
// magnified at first under the young drop's dome and settling flat as it
// spreads; just inside its edge the card is drawn out towards it, the
// colours splitting into fringes, and just outside it the photograph is
// pulled in towards the drop.
//
// Leave and the glass draws back into the middle and is gone. Come back
// before it's gone and it spreads again. It's the same whichever side the
// pointer comes in by.

import { paint } from '../card.js';
import { fullscreen, overlay, program, texture, uniforms } from '../gl.js';
import { toggle } from '../wipe.js';

const CONFIG = {
  duration: 1.3, // seconds for the glass to spread over the whole look
  ease: 'power3.out', // swells at once from the middle, slowing as it reaches the edges
  easeReverse: 'power3.out', // and on leaving draws back at once, slowing as it shrinks away
  edge: 25, // how far in from its edge the glass bends the card, in CSS pixels
  bend: 0.9, // how strongly it bends it there, as a multiple of that width
  pull: 44, // how far out from its edge it pulls the photograph in, in CSS pixels
  pullBend: 0.65, // how strongly, as a multiple of that width
  fringe: 0.64, // how far the colours split where it bends, 0 for none
  dome: 0.1, // how much the young drop magnifies the card, 0 to 1
  wobble: 0.1, // how much the glass wobbles as it spreads, as a share of its size
};

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uPhoto; // the photograph, mipmapped
uniform sampler2D uCard; // the card, painted from the page
uniform vec2 uResolution;
uniform float uPixel; // canvas pixels to a CSS pixel
uniform vec2 uCenter; // the glass's middle, in CSS pixels, y up
uniform vec2 uHalf; // its half width and half height, the same
uniform float uRound; // how square it is: 2, a circle; higher, a squarer tile with round corners
uniform vec4 uBend; // how far in from the edge the glass bends the card and how strongly, then how far out it pulls the photograph in and how strongly
uniform float uFringe;
uniform float uDome; // how much the card is magnified now, 0 to 1
uniform float uWobble; // how much the outline wobbles now
uniform float uPhase;

out vec4 color;

// How far a point (CSS pixels) is outside the glass: below 0 inside it, and
// the outward direction of its outline there.
float glass(vec2 p, out vec2 outward) {
  vec2 q = p - uCenter;
  float angle = atan(q.y, q.x);
  vec2 half_ = uHalf * (1.0 + uWobble * (0.6 * sin(3.0 * angle + uPhase) + 0.4 * sin(5.0 * angle - 1.3 * uPhase)));
  vec2 a = max(abs(q / half_), vec2(1e-6));
  float g = pow(pow(a.x, uRound) + pow(a.y, uRound), 1.0 / uRound);
  vec2 grad = sign(q) * pow(a, vec2(uRound - 1.0)) * pow(g, 1.0 - uRound) / half_;
  float l = max(length(grad), 1e-6);
  outward = grad / l;
  return (g - 1.0) / l;
}

void main() {
  vec2 size = uResolution / uPixel;
  vec2 p = gl_FragCoord.xy / uPixel;
  float aa = 0.75 / uPixel;

  vec2 outward;
  float sd = glass(p, outward);
  float inside = 1.0 - smoothstep(-aa, aa, sd);

  // Inside: the card, magnified about the middle by the dome, and near the
  // edge seen from further in, most at the edge itself, so it's drawn out
  // towards it.
  float x = clamp(-sd / uBend.x, 0.0, 1.0); // 0 at the edge, 1 where the bending stops
  float off = -uBend.y * uBend.x * (1.0 - x) * (1.0 - x);

  // Outside: the photograph near the edge seen from further out, so it's
  // pulled in towards the drop; no bending beyond uBend.z, where the page's
  // own photograph shows.
  float y = clamp(sd / uBend.z, 0.0, 1.0); // 0 at the edge, 1 where the pull stops
  off = mix(off, uBend.w * uBend.z * (1.0 - y) * (1.0 - y), 1.0 - inside);

  // Red bends a little more than blue, so the colours split where it bends.
  vec3 c;
  for (int k = 0; k < 3; k++) {
    vec2 q = p + outward * off * (1.0 + uFringe * float(1 - k));
    vec3 card = texture(uCard, (uCenter + (q - uCenter) * (1.0 - uDome)) / size).rgb;
    vec3 photo = texture(uPhoto, q / size).rgb;
    c[k] = mix(photo, card, inside)[k];
  }

  // A young drop is a little milky.
  c = mix(c, vec3(1.0), 0.1 * uDome * inside);
  color = vec4(c, 1.0) * max(inside, 1.0 - step(1.0, y));
}`;

function glass(look) {
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
  gl.uniform1f(u.uFringe, CONFIG.fringe);

  let size = { width: 1, height: 1 };

  // The glass when the hover has run p of its way: from nothing in the
  // middle, a round drop, domed, growing and squaring off into a tile with
  // round corners, flattening, until it covers the look with all its
  // bending beyond the edges.
  const ROUND = 5;
  const render = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    const { p } = state;
    if (p === 0) return;
    const { width: w, height: h } = size;
    const reach = 2 ** (1 / ROUND); // a tile with round corners must be this much bigger to cover the corners
    const full = [0.5 * w * reach + CONFIG.edge + 2, 0.5 * h * reach + CONFIG.edge + 2];
    const round = Math.min(...full) * p; // as a circle
    const half = [
      gsap.utils.interpolate(round, full[0], p * p),
      gsap.utils.interpolate(round, full[1], p * p),
    ];
    // The bending either side of the edge narrows with a small drop, so it
    // grows in from nothing and fades away with it.
    const small = Math.min(1, Math.min(...half) / CONFIG.pull);
    gl.uniform2f(u.uCenter, w / 2, h / 2);
    gl.uniform2f(u.uHalf, ...half);
    gl.uniform4f(u.uBend, CONFIG.edge * small, CONFIG.bend, CONFIG.pull * small, CONFIG.pullBend);
    gl.uniform1f(u.uRound, gsap.utils.interpolate(2, ROUND, p));
    gl.uniform1f(u.uDome, CONFIG.dome * (1 - p));
    gl.uniform1f(u.uWobble, CONFIG.wobble * Math.sin(Math.PI * p));
    gl.uniform1f(u.uPhase, gsap.ticker.time * 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // How far the hover has run, 0 to 1.
  const state = toggle(look, {
    duration: CONFIG.duration,
    ease: CONFIG.ease,
    easeReverse: CONFIG.easeReverse,
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

export default function glassy(looks) {
  looks.forEach(glass);
}
