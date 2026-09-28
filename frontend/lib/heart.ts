import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural placeholder heart.
 *
 * The body is a star-shaped surface built from the implicit "Taubin heart"
 *   (x² + 9/4·y² + z² − 1)³ − x²z³ − 9/80·y²z³ = 0
 * (x = left/right, y = front/back, z = up), then roughened with value noise and
 * vertex-coloured. Drop a real model at public/models/heart.glb to replace it.
 */

export const DEPTH = 1.25; // front/back thickness multiplier
export const HEART_EULER = new THREE.Euler(0.08, 0, 0.38); // apex tilts toward viewer's right

const F = (x: number, y: number, z: number) => {
  const a = x * x + 2.25 * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
};

/** Distance from the origin to the surface along a unit direction (heart space: x, depth, up). */
export function radiusAt(dx: number, dy: number, dz: number): number {
  const step = 0.02;
  let prev = 0;
  let lo = 0;
  let hi = 0;
  for (let r = step; r <= 2.2; r += step) {
    if (F(dx * r, dy * r, dz * r) > 0) {
      lo = prev;
      hi = r;
      break;
    }
    prev = r;
  }
  if (hi === 0) return prev || 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (F(dx * mid, dy * mid, dz * mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Point on the (un-rotated) heart surface in local scene space, for a direction in heart space. */
export function surfacePoint(dir: [number, number, number], lift = 0): THREE.Vector3 {
  const l = Math.hypot(dir[0], dir[1], dir[2]);
  const dx = dir[0] / l;
  const dy = dir[1] / l;
  const dz = dir[2] / l;
  const r = radiusAt(dx, dy, dz) + lift;
  return new THREE.Vector3(dx * r, dz * r, dy * r * DEPTH);
}

/* ---- tiny value noise ---- */
function hash(ix: number, iy: number, iz: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483629);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const sm = (t: number) => t * t * (3 - 2 * t);
export function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), l(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
    l(l(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), l(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy),
    fz
  );
}

export function buildHeartGeometry(): THREE.BufferGeometry {
  const base = new THREE.SphereGeometry(1, 180, 130);
  base.deleteAttribute("normal");
  base.deleteAttribute("uv");
  const g = mergeVertices(base, 1e-4);
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);

  const muscle = new THREE.Color("#6e0c12");
  const deep = new THREE.Color("#3f060b");
  const fat = new THREE.Color("#c99a62");
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    // sphere direction (three y-up) -> heart space (x, depth, up)
    const sx = pos.getX(i), sy = pos.getY(i), sz = pos.getZ(i);
    const dx = sx, dy = sz, dz = sy;
    const r = radiusAt(dx, dy, dz);
    let px = dx * r, py = dz * r, pz = dy * r * DEPTH;

    const n1 = noise3(px * 2.3 + 11, py * 2.3, pz * 2.3);
    const n2 = noise3(px * 7.0, py * 7.0 + 5, pz * 7.0);
    const bump = 1 + (n1 - 0.5) * 0.06 + (n2 - 0.5) * 0.02;
    px *= bump; py *= bump; pz *= bump;
    pos.setXYZ(i, px, py, pz);

    // colour: deeper red toward the apex, pale fat tissue around the base
    c.copy(muscle).lerp(deep, THREE.MathUtils.clamp((0.2 - py) * 0.6, 0, 0.8) * (0.5 + n1 * 0.5));
    const fatAmount = THREE.MathUtils.smoothstep(py, 0.25, 0.85) * THREE.MathUtils.smoothstep(n2, 0.35, 0.9) * 0.42;
    c.lerp(fat, fatAmount);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/* Coronary paths on the front/side of the heart, as directions in heart space (x, depth, up).
   All three start at the aortic root (top, slightly front) like the real thing. */
export const LAD_DIRS: [number, number, number][] = [
  [0.12, 0.35, 0.95], [0.2, 0.85, 0.55], [0.2, 0.95, 0.15], [0.16, 0.9, -0.3], [0.06, 0.65, -0.78],
];
export const LCX_DIRS: [number, number, number][] = [
  [0.12, 0.35, 0.95], [0.5, 0.5, 0.72], [0.92, 0.1, 0.38], [0.95, -0.35, 0.05],
];
export const RCA_DIRS: [number, number, number][] = [
  [-0.02, 0.35, 0.95], [-0.5, 0.55, 0.66], [-0.9, 0.35, 0.18], [-0.88, 0.0, -0.4], [-0.5, -0.3, -0.75],
];
/** Where the camera dives in: on the front of the LAD, just below the aortic root. */
export const ENTRANCE_DIR: [number, number, number] = [0.17, 0.9, 0.52];
