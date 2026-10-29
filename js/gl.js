// WebGL 2 helpers for the effects that draw on a canvas.

// Every WebGL effect draws one triangle big enough to cover its canvas, with
// corners at (-1, -1), (3, -1) and (-1, 3) in clip space (the canvas runs
// from -1 to 1 each way); the fragment shader does the rest, from gl_FragCoord.
export const fullscreen = `#version 300 es
const vec2 corners[3] = vec2[](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);
}`;

// A canvas over the look's photograph, and its WebGL 2 context. Throws where
// there's no WebGL 2.
export function overlay(look) {
  const canvas = document.createElement('canvas');
  canvas.className = 'look__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { antialias: false });
  if (!gl) throw new Error('WebGL 2 is not available');
  look.querySelector('.look__img').after(canvas);
  return gl;
}

export function program(gl, vertex, fragment) {
  const p = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(p, shader);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// The location of every uniform the program uses, by name: `u.uLead`. An
// array (which WebGL lists as `uDrops[0]`) goes by its plain name too, for
// setting it whole with `uniform3fv()` and the like.
export function uniforms(gl, program) {
  const u = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const { name } = gl.getActiveUniform(program, i);
    u[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(program, name);
  }
  return u;
}

// A texture on `unit` from an image or a canvas, flipped to match
// gl_FragCoord (y up). Call it again with the same texture to replace the
// picture, say after a canvas is redrawn.
export function texture(gl, unit, source, { mipmaps = false, tex = gl.createTexture() } = {}) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

// A float texture on `unit` from numbers worked out on the CPU, `channels`
// (1 or 2) to a pixel, rows bottom to top, smoothed between its pixels so
// shapes drawn from it stay smooth at any size. Pass the same `tex` again to
// replace the numbers.
export function field(gl, unit, { data, w, h }, { channels = 1, tex = gl.createTexture() } = {}) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  const [inner, format] = channels === 2 ? [gl.RG16F, gl.RG] : [gl.R16F, gl.RED];
  gl.texImage2D(gl.TEXTURE_2D, 0, inner, w, h, 0, format, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
