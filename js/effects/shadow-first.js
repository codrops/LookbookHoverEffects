// 01 · Shadow-first
//
// Hover a look and the card's colour sweeps across the photograph from the
// side the pointer came in by, but it reaches the picture's shadows before
// its highlights: the darker a part of the photograph, the sooner the colour
// gets there. So the photograph draws the sweep's leading edge itself,
// frizzy through curls, clean down a lapel, different on every look, with
// the darkest parts ahead of it filling first. A hairline of light runs
// along the edge as it crosses.
//
// Leave by the far half of the look and the colour drains away the same
// way, out of the shadows first, until it's gone off the far side; leave by
// the near half and it goes back, out of the highlights first. Come back
// before it's gone and it turns round.

import { paint } from '../card.js';
import { fullscreen, overlay, program, texture, uniforms } from '../gl.js';
import { wipe } from '../wipe.js';

const CONFIG = {
  duration: 0.8, // seconds for the colour to cross the look
  ease: 'power1.out', // sets off at once, slowing as it reaches the highlights
  pull: 0.75, // how far ahead of the sweep the shadows fill, as a share of the look (0: a straight wipe)
  light: 0.2, // how bright the hairline of light along the edge is, 0 to 1
};

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uPhoto; // the photograph, mipmapped: only its tones are used
uniform sampler2D uCard; // the card, painted from the page
uniform vec2 uResolution;
uniform vec3 uSweep; // d = dot(uv, uSweep.xy) + uSweep.z: 0 on the side the colour comes in by, 1 on the far side
uniform vec2 uTones; // the photograph's darkest and lightest tones
uniform float uPull;
uniform float uLead; // the leading edge, 0 (not started) to 1 (across)
uniform float uTrail; // the trailing edge, the same
uniform float uLight;

out vec4 color;

float tone(vec2 uv, float level) {
  float l = dot(textureLod(uPhoto, uv, level).rgb, vec3(0.2126, 0.7152, 0.0722));
  return clamp((l - uTones.x) / (uTones.y - uTones.x), 0.0, 1.0);
}

// The hairline of light along an edge reached at t = edge, on the side the
// sign of side points to.
float rim(float t, float edge, float w, float side) {
  float px = side * (t - edge) / w; // pixels from the edge
  float band = smoothstep(-1.0, 0.0, px) * (1.0 - smoothstep(1.0, 2.5, px)); // about 2 pixels wide
  // Where the photograph's tones change sharply, t jumps from pixel to pixel
  // and px comes out short, so the band also keeps to pixels reached at
  // nearly the same moment as the edge.
  float near = 1.0 - smoothstep(0.0, 0.02, abs(t - edge));
  return band * near;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float d = dot(uv, uSweep.xy) + uSweep.z;

  // When the colour reaches this pixel, 0 to 1: later the further across it
  // is and the lighter. A sharp and a soft reading of its tone, so the edge
  // follows the picture's shapes without breaking up into its grain.
  float t = mix(d, mix(tone(uv, 2.0), tone(uv, 4.5), 0.5), uPull);
  float w = max(fwidth(t), 1e-5); // how much t changes from one pixel to the next

  // The edges run from a little before 0 to a little past 1, so the soft
  // edge is fully off the look at either end.
  float lead = mix(-0.01, 1.01, uLead);
  float trail = mix(-0.01, 1.01, uTrail);
  float covered = (1.0 - smoothstep(lead - 1.5 * w, lead, t)) * smoothstep(trail - 1.5 * w, trail, t);

  // The hairline of light: just ahead of the leading edge and just behind
  // the trailing one.
  float light = max(rim(t, lead, w, 1.0), rim(t, trail, w, -1.0)) * uLight * (1.0 - covered);

  vec3 card = texture(uCard, uv).rgb;
  color = vec4(card * covered + vec3(1.0, 0.97, 0.92) * light, covered + light);
}`;

// The photograph's darkest and lightest tones (2nd and 98th percentiles),
// so the colour spreads over a photograph's whole range of tones, whether
// it's a dark one or a light one.
function tones(img) {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 50;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const l = [];
  for (let i = 0; i < data.length; i += 4) {
    l.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
  }
  l.sort((a, b) => a - b);
  return [l[Math.floor(l.length * 0.02)], l[Math.floor(l.length * 0.98)]];
}

function shade(look) {
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
  gl.uniform2f(u.uTones, ...tones(img));
  gl.uniform1f(u.uPull, CONFIG.pull);
  gl.uniform1f(u.uLight, CONFIG.light);

  const render = () => {
    gl.uniform1f(u.uLead, edges.lead);
    gl.uniform1f(u.uTrail, edges.trail);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const edges = wipe(look, {
    duration: CONFIG.duration,
    ease: CONFIG.ease,
    start: (sweep) => gl.uniform3f(u.uSweep, ...sweep),
    update: render,
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
    render();
  }).observe(look);
}

export default function shadowFirst(looks) {
  looks.forEach(shade);
}
