// Anti-aliased drawing primitives into Fields. Shapes wrap around the edges by default so
// motifs near a tile border continue on the opposite side (seamless tiling).
//
// `value` is written with a blend mode: "set" (default, coverage-weighted lerp), "max", "add" or "mul".

function put(f, x, y, cover, value, mode, wrap) {
  if (cover <= 0) return;
  if (wrap) {
    x = ((x % f.w) + f.w) % f.w;
    y = ((y % f.h) + f.h) % f.h;
  } else if (x < 0 || y < 0 || x >= f.w || y >= f.h) {
    return;
  }
  const i = y * f.w + x;
  const old = f.data[i];
  switch (mode) {
    case "max":
      f.data[i] = Math.max(old, old + (value - old) * cover);
      break;
    case "add":
      f.data[i] = old + value * cover;
      break;
    case "mul":
      f.data[i] = old * (1 + (value - 1) * cover);
      break;
    default:
      f.data[i] = old + (value - old) * cover;
  }
}

const aa = (d) => Math.min(1, Math.max(0, 0.5 - d)); // coverage from signed distance in px

/** Axis-aligned rectangle [x0, x1) x [y0, y1) in pixels (floats allowed), optional corner radius. */
export function rect(f, x0, y0, x1, y1, value, { mode = "set", wrap = true, radius = 0, soft = 0 } = {}) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2;
  const hy = (y1 - y0) / 2;
  const pad = 2 + soft;
  for (let y = Math.floor(y0 - pad); y <= Math.ceil(y1 + pad); y++) {
    for (let x = Math.floor(x0 - pad); x <= Math.ceil(x1 + pad); x++) {
      const qx = Math.abs(x + 0.5 - cx) - hx + radius;
      const qy = Math.abs(y + 0.5 - cy) - hy + radius;
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const cover = soft > 0 ? Math.min(1, Math.max(0, 0.5 - d / soft)) : aa(d);
      put(f, x, y, cover, value, mode, wrap);
    }
  }
}

/** Filled disc; `soft` > 0 gives a smooth falloff of that many pixels. */
export function disc(f, cx, cy, r, value, { mode = "set", wrap = true, soft = 0 } = {}) {
  const pad = Math.ceil(r + 2 + soft);
  for (let y = Math.floor(cy - pad); y <= Math.ceil(cy + pad); y++) {
    for (let x = Math.floor(cx - pad); x <= Math.ceil(cx + pad); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r;
      const cover = soft > 0 ? Math.min(1, Math.max(0, 0.5 - d / soft)) : aa(d);
      put(f, x, y, cover, value, mode, wrap);
    }
  }
}

/** Thick line segment with round caps. */
export function line(f, x0, y0, x1, y1, thickness, value, { mode = "set", wrap = true } = {}) {
  const r = thickness / 2;
  const minX = Math.min(x0, x1) - r - 2;
  const maxX = Math.max(x0, x1) + r + 2;
  const minY = Math.min(y0, y1) - r - 2;
  const maxY = Math.max(y0, y1) + r + 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      const px = x + 0.5 - x0;
      const py = y + 0.5 - y0;
      const t = Math.min(1, Math.max(0, (px * dx + py * dy) / len2));
      const d = Math.hypot(px - dx * t, py - dy * t) - r;
      put(f, x, y, aa(d), value, mode, wrap);
    }
  }
}

/** Polyline through [[x, y], ...]. */
export function polyline(f, pts, thickness, value, opts) {
  for (let i = 0; i + 1 < pts.length; i++) line(f, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], thickness, value, opts);
}

/** Ring (outline of a circle). */
export function ring(f, cx, cy, r, thickness, value, { mode = "set", wrap = true } = {}) {
  const pad = Math.ceil(r + thickness + 2);
  for (let y = Math.floor(cy - pad); y <= Math.ceil(cy + pad); y++) {
    for (let x = Math.floor(cx - pad); x <= Math.ceil(cx + pad); x++) {
      const d = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r) - thickness / 2;
      put(f, x, y, aa(d), value, mode, wrap);
    }
  }
}
