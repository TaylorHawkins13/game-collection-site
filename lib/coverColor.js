'use client';

// Samples a cover image off-DOM to pull a dominant color for the slab
// styling. Uses a separate hidden Image (not the visible <img> in the
// card) so a CORS-restricted cover simply fails silently here without
// ever risking breaking the actual visible cover art.
const cache = new Map();

function sampleColorFromImage(img) {
  try {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue; // skip transparent pixels
      const rr = data[i];
      const gg = data[i + 1];
      const bb = data[i + 2];
      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);
      if (max > 245 && min > 235) continue; // skip near-white padding
      if (max < 18) continue; // skip near-black padding
      r += rr;
      g += gg;
      b += bb;
      count++;
    }
    if (count === 0) return null;
    return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
  } catch (e) {
    // Tainted canvas — the image host didn't allow cross-origin reads.
    return null;
  }
}

export function getCoverColor(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    if (cache.has(src)) return resolve(cache.get(src));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const color = sampleColorFromImage(img);
      cache.set(src, color);
      resolve(color);
    };
    img.onerror = () => {
      cache.set(src, null);
      resolve(null);
    };
    img.src = src;
  });
}

export function colorToCss({ r, g, b }, alpha = 1) {
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function shadeColor({ r, g, b }, amount) {
  const clamp = (v) => Math.max(0, Math.min(255, v));
  return `rgb(${clamp(r + amount)}, ${clamp(g + amount)}, ${clamp(b + amount)})`;
}

export function readableTextColor({ r, g, b }) {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? '#141625' : '#ffffff';
}
