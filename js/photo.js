// A photograph's tones on the CPU, for the effects that shape their edges
// from them. Each is worked out once, when the effect starts.

// The photograph's tones, `w` pixels wide: its brightness, spread so its
// darkest tones (the 2nd percentile) are 0 and its lightest (the 98th) are
// 1, whether it's a dark photograph or a light one. Rows run bottom to top,
// as WebGL reads them.
export function tones(img, w) {
  const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((h - 1 - y) * w + x) * 4;
      data[y * w + x] = (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
    }
  }
  const sorted = data.slice().sort();
  const dark = sorted[Math.floor(sorted.length * 0.02)];
  const light = sorted[Math.floor(sorted.length * 0.98)];
  for (let i = 0; i < data.length; i++) data[i] = gsap.utils.clamp(0, 1, (data[i] - dark) / (light - dark));
  return { data, w, h };
}

// A Gaussian blur of a grid of numbers, w by h, across and then down.
// Past the grid's sides it repeats the pixel at the side.
export function blur(src, w, h, sigma) {
  const r = Math.ceil(sigma * 3);
  const kernel = new Float32Array(2 * r + 1);
  for (let i = -r; i <= r; i++) kernel[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  const total = kernel.reduce((a, b) => a + b);
  kernel.forEach((k, i) => (kernel[i] = k / total));
  const pass = (from, to, length, count, step, stride) => {
    for (let line = 0; line < count; line++) {
      const start = line * stride;
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let j = -r; j <= r; j++) {
          const at = i + j < 0 ? 0 : i + j >= length ? length - 1 : i + j;
          sum += from[start + at * step] * kernel[j + r];
        }
        to[start + i * step] = sum;
      }
    }
  };
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  pass(src, tmp, w, h, 1, w); // across each row
  pass(tmp, out, h, w, w, 1); // down each column
  return out;
}
