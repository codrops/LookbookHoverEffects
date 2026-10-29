// 08 · Channel
//
// Hover a look and it changes like a channel, in bands across it: each band
// breaks up at its own moment, and the bands are dealt again many times a
// second, so the picture flickers between them. A broken band isn't grey
// static but a grain of the photograph's own colours and the card's,
// scrambled and redrawn every few frames, which settles into the card.
//
// Leave and it changes back the same way, band by band, card to grain to
// photograph. It's the same whichever side the pointer comes in by.

import { paint } from '../card.js';
import { fullscreen, overlay, program, texture, uniforms } from '../gl.js';
import { toggle } from '../wipe.js';

const CONFIG = {
  duration: 1, // seconds for the whole change
  ease: 'power1.inOut',
  bands: [6, 14], // how many wide bands and how many narrow ones run across the look; each band's moment is set by both
  settle: 0.3, // how long a band stays broken before it settles into the card, as a share of the change
  deals: 4, // how many times a second the bands are dealt again
  grain: 3, // the size of a grain, in CSS pixels
  redraws: 30, // how many times a second the grain is redrawn
  scatter: 0.25, // how far from its place a grain can take its colour, as a share of the look
  photo: 0.6, // the share of the grain that takes its colour from the photograph, the rest from the card
};

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uPhoto; // the photograph
uniform sampler2D uCard; // the card, painted from the page
uniform vec2 uResolution;
uniform float uPixel; // canvas pixels to a CSS pixel
uniform float uChanged; // how far the change has gone, 0 to 1
uniform vec2 uBands;
uniform float uSettle;
uniform float uGrain;
uniform float uScatter;
uniform float uPhotoShare;
uniform float uDeal; // which deal of the bands this is: changes CONFIG.deals times a second
uniform float uFrame; // which drawing of the grain: changes CONFIG.redraws times a second

out vec4 color;

// A random number from 0 to 1 for every point.
float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // This band's moment, from its wide band and its narrow one: it breaks up
  // once the change has gone that far, and settles into the card uSettle
  // later. The last band settles just as the change ends.
  float r = mix(random(vec2(floor(uv.y * uBands.x), uDeal)), random(vec2(floor(uv.y * uBands.y), uDeal + 3.1)), 0.5);
  float breaks = r * (1.0 - uSettle);
  float since = (uChanged - breaks) / uSettle; // below 0, still the photograph; 0 to 1, broken; past 1, the card
  float changed = step(0.0, since) * step(0.001, uChanged);

  // The grain: each one takes its colour from somewhere near, from the
  // photograph or from the card, and more of them settle on the card's own
  // colour at their own place the longer the band has been broken.
  vec2 grain = floor(gl_FragCoord.xy / uPixel / uGrain);
  vec2 jump = (vec2(random(grain + uFrame * 1.31), random(grain - uFrame * 2.07 + 9.2)) - 0.5) * uScatter;
  vec2 from = clamp(uv + jump, 0.0, 1.0);
  float pick = random(grain + uFrame * 0.73 + 4.4);
  vec3 scrambled = pick < uPhotoShare ? texture(uPhoto, from).rgb : texture(uCard, from).rgb;
  float settled = step(random(grain + uFrame * 3.9 + 1.7), since);
  vec3 card = texture(uCard, uv).rgb;

  color = vec4(mix(scrambled, card, settled), 1.0) * changed;
}`;

function channel(look) {
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
  gl.uniform2f(u.uBands, ...CONFIG.bands);
  gl.uniform1f(u.uSettle, CONFIG.settle);
  gl.uniform1f(u.uGrain, CONFIG.grain);
  gl.uniform1f(u.uScatter, CONFIG.scatter);
  gl.uniform1f(u.uPhotoShare, CONFIG.photo);

  // The bands are dealt and the grain redrawn by the clock, not every frame.
  const render = () => {
    gl.uniform1f(u.uChanged, change.p);
    gl.uniform1f(u.uDeal, Math.floor(gsap.ticker.time * CONFIG.deals) % 97);
    gl.uniform1f(u.uFrame, Math.floor(gsap.ticker.time * CONFIG.redraws) % 97);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // How far the change has gone, 0 to 1.
  const change = toggle(look, {
    duration: CONFIG.duration,
    ease: CONFIG.ease,
    update: render,
  });

  new ResizeObserver(() => {
    const { width, height } = look.getBoundingClientRect();
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

export default function changing(looks) {
  looks.forEach(channel);
}
