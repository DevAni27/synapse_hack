import * as THREE from "three";
import { ENTRANCE_DIR, HEART_EULER, surfacePoint } from "./heart";

/**
 * Camera path for the scroll-driven intro:
 *   far view of the heart -> approach the left anterior surface -> dive through it
 *   -> travel down a stylised vessel -> arrive in open space where the upload panel lives.
 * Everything (camera, tunnel, chapter timing) derives from this one curve.
 */

// Where the dive starts: on the heart surface near the origin of the LAD.
export const ENTRANCE = surfacePoint(ENTRANCE_DIR, 0).applyEuler(HEART_EULER);
const N = ENTRANCE.clone().normalize();

const at = (base: THREE.Vector3, along: number, x = 0, y = 0, z = 0) =>
  base.clone().addScaledVector(N, along).add(new THREE.Vector3(x, y, z));

export const CAMERA_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0.4, 0.5, 7.4),
  at(ENTRANCE, 3.2, 0.7, 0.4, 0),
  at(ENTRANCE, 1.5, 0.25, 0.15, 0),
  at(ENTRANCE, 0.4),
  at(ENTRANCE, -0.55),
  new THREE.Vector3(0.05, 0.0, 0.1),
  new THREE.Vector3(0, -0.05, -2.2),
  new THREE.Vector3(0, 0.02, -5.0),
  new THREE.Vector3(0, 0.08, -8.4),
  new THREE.Vector3(0, 0.1, -9.6),
];

export const CAMERA_CURVE = new THREE.CatmullRomCurve3(CAMERA_POINTS, false, "centripetal");

const SAMPLES = 800;
export const PATH_SAMPLES = CAMERA_CURVE.getSpacedPoints(SAMPLES);

const idxNearest = (target: THREE.Vector3) => {
  let best = 0;
  let bd = Infinity;
  PATH_SAMPLES.forEach((p, i) => {
    const d = p.distanceToSquared(target);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
};

/** Curve parameter (0..1) at which the camera meets the heart surface. */
export const T_ENTER = idxNearest(ENTRANCE) / SAMPLES;
/** Curve parameter where the tunnel opens into free space. */
export const T_TUNNEL_END = PATH_SAMPLES.findIndex((p) => p.z < -4.6) / SAMPLES;

/** Scroll progress at which the camera reaches the end of the path; the rest is the resting panel. */
export const ARRIVE_P = 0.86;

/** Scroll progress (0..1) -> curve parameter, with a gentle ease at both ends. */
export const tOf = (p: number) => {
  const u = THREE.MathUtils.clamp(p / ARRIVE_P, 0, 1);
  return (1 - Math.cos(Math.PI * u)) / 2;
};
/** Inverse of tOf: curve parameter -> scroll progress. */
export const pOfT = (t: number) => (Math.acos(1 - 2 * THREE.MathUtils.clamp(t, 0, 1)) / Math.PI) * ARRIVE_P;

/** Chapter timing expressed in scroll progress. */
export function getTiming() {
  const pEnter = pOfT(T_ENTER);
  const pTunnelEnd = pOfT(T_TUNNEL_END);
  const mid = (pEnter + pTunnelEnd) / 2;
  return {
    hero: [-0.05, 0.09] as const,
    heart: [0.1, Math.max(0.13, pEnter - 0.03)] as const,
    left: [pEnter + 0.015, mid] as const,
    right: [mid, pTunnelEnd - 0.01] as const,
    panel: [ARRIVE_P - 0.07, 1] as const,
    pEnter,
    pTunnelEnd,
  };
}

/** Tunnel curve that hugs the camera path, so the camera never clips the wall. */
export function buildTunnelCurve() {
  const i0 = Math.max(0, Math.floor((T_ENTER - 0.02) * SAMPLES));
  const i1 = Math.min(SAMPLES, Math.ceil((T_TUNNEL_END + 0.02) * SAMPLES));
  const pts: THREE.Vector3[] = [];
  for (let i = i0; i <= i1; i += 8) pts.push(PATH_SAMPLES[i].clone());
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}
