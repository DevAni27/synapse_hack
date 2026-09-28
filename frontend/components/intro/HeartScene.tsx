"use client";

/* r3f scenes mutate three.js objects and refs inside useFrame by design; the React Compiler
   immutability rule does not apply to that pattern. */
/* eslint-disable react-hooks/immutability */

import { Suspense, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  HEART_EULER,
  LAD_DIRS,
  LCX_DIRS,
  RCA_DIRS,
  buildHeartGeometry,
  noise3,
  surfacePoint,
} from "@/lib/heart";
import {
  ARRIVE_P,
  CAMERA_CURVE,
  ENTRANCE,
  PATH_SAMPLES,
  T_ENTER,
  T_TUNNEL_END,
  buildTunnelCurve,
  tOf,
} from "@/lib/introPath";

export interface SceneState {
  p: number; // smoothed scroll progress 0..1
  t: number; // camera curve parameter 0..1
  beat: number; // heartbeat pulse 0..1
  q: number; // artery-tree draw-in 0..1
}

const smooth = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

/* ------------------------------------------------------------------ */
/* Camera, fog and the shared scene state                              */
/* ------------------------------------------------------------------ */
function Rig({ progressRef, st }: { progressRef: RefObject<number>; st: RefObject<SceneState> }) {
  const lamp = useRef<THREE.PointLight>(null);
  const bg = useMemo(() => ({ out: new THREE.Color("#0b0d0f"), tunnel: new THREE.Color("#1c0608"), end: new THREE.Color("#12060a") }), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const v = useMemo(() => ({ look: new THREE.Vector3(), ahead: new THREE.Vector3(), centre: new THREE.Vector3(0.1, 0.15, 0) }), []);

  useFrame((state, dt) => {
    const s = st.current;
    s.p += (progressRef.current - s.p) * (1 - Math.exp(-dt * 5));
    s.t = tOf(s.p);

    // Heartbeat: a "lub-dub"
    const phase = (state.clock.elapsedTime * 1.1) % 1;
    s.beat = Math.exp(-(((phase - 0.08) / 0.05) ** 2)) + 0.6 * Math.exp(-(((phase - 0.3) / 0.06) ** 2));
    s.q = smooth(s.p, ARRIVE_P - 0.16, ARRIVE_P - 0.01);

    const pos = CAMERA_CURVE.getPointAt(s.t);
    const tan = CAMERA_CURVE.getTangentAt(s.t);
    const px = state.pointer.x;
    const py = state.pointer.y;
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.position.set(pos.x + px * 0.1, pos.y + py * 0.07, pos.z);
    // Look at the heart first, then at the entrance as we close in, then straight down the vessel
    v.ahead.set(pos.x + tan.x * 2 + px * 0.06, pos.y + tan.y * 2 + py * 0.03, pos.z + tan.z * 2);
    const w1 = smooth(s.t, 0.02, T_ENTER - 0.08);
    const w2 = smooth(s.t, T_ENTER - 0.05, T_ENTER + 0.03);
    v.look.copy(v.centre).lerp(ENTRANCE, w1).lerp(v.ahead, w2);
    cam.lookAt(v.look);

    // Push the heart to the right on wide screens so the hero text has room
    // (on phones: shrink it and lift it above the headline instead)
    const w = state.size.width;
    const h = state.size.height;
    const phone = w < 700;
    const early = 1 - smooth(s.p, 0.02, 0.2);
    const shiftX = w >= 900 ? w * 0.17 * early : 0;
    const shiftY = phone ? h * 0.13 * early : 0;
    if (shiftX > 0.5 || shiftY > 0.5) cam.setViewOffset(w, h, -shiftX, shiftY, w, h);
    else if (cam.view?.enabled) cam.clearViewOffset();
    const zoom = phone ? lerp(0.62, 1, smooth(s.t, T_ENTER - 0.12, T_ENTER - 0.02)) : 1;
    if (Math.abs(cam.zoom - zoom) > 0.002) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }

    // Fog + background move from cool dark, to blood red inside the vessel, to a quieter dark red at the end
    const inside = smooth(s.t, T_ENTER - 0.03, T_ENTER + 0.03);
    const open = smooth(s.t, T_TUNNEL_END - 0.03, T_TUNNEL_END + 0.05);
    tmp.copy(bg.out).lerp(bg.tunnel, inside).lerp(bg.end, open);
    (state.scene.background as THREE.Color).copy(tmp);
    const fog = state.scene.fog as THREE.FogExp2;
    fog.color.copy(tmp);
    fog.density = lerp(0.028, 0.16, inside) * (1 - open) + 0.05 * open;

    if (lamp.current) {
      lamp.current.position.copy(cam.position);
      lamp.current.intensity = inside * (9 + 4 * s.beat);
    }
  });

  return <pointLight ref={lamp} color="#ff8a66" distance={9} decay={2} intensity={0} />;
}

/* ------------------------------------------------------------------ */
/* The heart                                                           */
/* ------------------------------------------------------------------ */
function curveThrough(dirs: [number, number, number][], lift = 0.045) {
  return new THREE.CatmullRomCurve3(dirs.map((d) => surfacePoint(d, lift)));
}

/** Fallback shown only while the real model is loading. */
function ProceduralHeart({ mats }: { mats: THREE.Material[] }) {
  const geo = useMemo(() => buildHeartGeometry(), []);
  const parts = useMemo(() => {
    const mk = (c: string, rough: number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => {
      const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, transparent: true, ...extra });
      mats.push(m);
      return m;
    };
    return {
      body: (() => {
        const m = new THREE.MeshPhysicalMaterial({
          vertexColors: true,
          roughness: 0.42,
          clearcoat: 0.7,
          clearcoatRoughness: 0.32,
          sheen: 0.6,
          sheenColor: new THREE.Color("#ff6b5c"),
          transparent: true,
        });
        mats.push(m);
        return m;
      })(),
      vessel: mk("#b3402f", 0.4),
      aorta: mk("#a8443b", 0.5),
      pulm: mk("#6b5a86", 0.55),
      cava: mk("#48598a", 0.55),
      lad: buildTube(curveThrough(LAD_DIRS), 110, 10, (u) => 0.05 * (1 - 0.65 * u)),
      lcx: buildTube(curveThrough(LCX_DIRS), 90, 10, (u) => 0.042 * (1 - 0.65 * u)),
      rca: buildTube(curveThrough(RCA_DIRS), 110, 10, (u) => 0.046 * (1 - 0.65 * u)),
      aortaG: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.05, 0.55, 0.4), new THREE.Vector3(0.08, 1.05, 0.38),
          new THREE.Vector3(-0.1, 1.5, 0.12), new THREE.Vector3(-0.55, 1.62, -0.2),
        ]), 40, 0.22, 20),
      pulmG: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.62, 0.6, 0.62), new THREE.Vector3(0.74, 1.05, 0.55), new THREE.Vector3(0.55, 1.5, 0.32),
        ]), 30, 0.18, 18),
      cavaG: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([new THREE.Vector3(-0.78, 0.55, 0.1), new THREE.Vector3(-0.86, 1.3, 0.02)]), 20, 0.16, 16),
    };
  }, [mats]);

  return (
    <>
      <mesh geometry={geo} material={parts.body} />
      <mesh geometry={parts.lad} material={parts.vessel} />
      <mesh geometry={parts.lcx} material={parts.vessel} />
      <mesh geometry={parts.rca} material={parts.vessel} />
      <mesh geometry={parts.aortaG} material={parts.aorta} />
      <mesh geometry={parts.pulmG} material={parts.pulm} />
      <mesh geometry={parts.cavaG} material={parts.cava} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Stylised "imaging" heart: dark glass + point cloud + glowing arteries */
/* Real anatomical mesh: CC BY 4.0, see public/models/CREDITS.md        */
/* ------------------------------------------------------------------ */
const HEART_SIZE = 3.0;
const HEART_MODEL_ROT: [number, number, number] = [0, 0, 0];

/* Coronary paths as (x, y) in the model's normalised bounding box, seen from the front.
   Each point is projected onto the front surface by a ray, so the arteries hug the mesh. */
const GLOW_PATHS: { color: string; r: number; pts: [number, number][] }[] = [
  { color: "#e5484d", r: 0.0085, pts: [[0.52, 0.76], [0.57, 0.68], [0.6, 0.58], [0.62, 0.46], [0.64, 0.32], [0.65, 0.18], [0.64, 0.05]] }, // LAD
  { color: "#3e8bff", r: 0.0078, pts: [[0.52, 0.76], [0.62, 0.71], [0.73, 0.63], [0.83, 0.5], [0.88, 0.37], [0.9, 0.26]] }, // LCX
  { color: "#3db37a", r: 0.0085, pts: [[0.47, 0.75], [0.38, 0.67], [0.24, 0.55], [0.12, 0.4], [0.14, 0.25], [0.3, 0.12], [0.46, 0.05]] }, // RCA
];

function GLBHeart({ url, mats }: { url: string; mats: THREE.Material[] }) {
  const gltf = useGLTF(url);
  const obj = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });

    meshes.forEach((mesh) => {
      const glow: THREE.Object3D[] = [];
      const g = mesh.geometry.clone();
      g.computeVertexNormals();
      g.computeBoundingBox();
      mesh.geometry = g;
      const bb = g.boundingBox!;
      const size = bb.getSize(new THREE.Vector3());

      // 1. dark glass body with a bright fresnel edge
      const glass = new THREE.MeshStandardMaterial({ color: "#02080c", roughness: 0.4, metalness: 0, transparent: true, depthWrite: false });
      glass.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          "#include <opaque_fragment>",
          `float f = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.4);
           outgoingLight = mix(vec3(0.015, 0.05, 0.07), vec3(0.30, 0.80, 0.90), f);
           diffuseColor.a *= 0.42 + 0.58 * f;
           #include <opaque_fragment>`,
        );
      };
      glass.userData.base = 1;
      glass.userData.noDepth = true;
      mesh.material = glass;
      mesh.renderOrder = 0;
      mats.push(glass);

      // 2. fine point cloud over the surface
      const pm = new THREE.PointsMaterial({
        color: "#8fe3ee",
        size: 0.016, // world units (not model units)
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        map: makeSpriteTexture(),
      });
      pm.userData.base = 0.55;
      pm.userData.noDepth = true;
      const pointsObj = new THREE.Points(g, pm);
      pointsObj.renderOrder = 1;
      mats.push(pm);
      glow.push(pointsObj);

      // 3. glowing coronary arteries: project each path onto the front of the mesh
      mesh.updateMatrixWorld(true);
      for (const path of GLOW_PATHS) {
        const pts: THREE.Vector3[] = [];
        for (const [nx, ny] of path.pts) {
          const x = bb.min.x + nx * size.x;
          const y = bb.min.y + ny * size.y;
          const origin = mesh.localToWorld(new THREE.Vector3(x, y, bb.max.z + size.z));
          raycaster.set(origin, new THREE.Vector3(0, 0, -1));
          const hit = raycaster.intersectObject(mesh, false)[0];
          if (!hit) continue;
          const local = mesh.worldToLocal(hit.point.clone());
          const n = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
          local.addScaledVector(n, size.y * 0.006); // sit just above the surface
          pts.push(local);
        }
        if (pts.length < 3) continue;
        const curve = new THREE.CatmullRomCurve3(pts);
        const col = new THREE.Color(path.color);
        const core = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.4), transparent: true, toneMapped: false });
        core.userData.base = 1;
        const halo = new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        halo.userData.base = 0.18;
        halo.userData.noDepth = true;
        const R = size.y * path.r;
        const coreMesh = new THREE.Mesh(buildTube(curve, 90, 10, (u) => R * (1 - 0.55 * u)), core);
        const haloMesh = new THREE.Mesh(buildTube(curve, 90, 10, (u) => R * 3.2 * (1 - 0.5 * u)), halo);
        coreMesh.renderOrder = 2;
        haloMesh.renderOrder = 3;
        mats.push(core, halo);
        glow.push(coreMesh, haloMesh);
      }
      glow.forEach((m) => mesh.add(m));
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(HEART_SIZE / Math.max(size.x, size.y, size.z));
    return wrap;
  }, [gltf, mats]);
  return <primitive object={obj} rotation={HEART_MODEL_ROT} />;
}

/** Soft studio reflections so the wet surface has something to reflect (generated locally, no download). */
function Studio() {
  const { gl, scene } = useThree();
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    scene.environmentIntensity = 0.4;
    pm.dispose();
  }, [gl, scene]);
  return null;
}

function Heart({ st }: { st: RefObject<SceneState> }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo<THREE.Material[]>(() => [], []);
  // Set NEXT_PUBLIC_HEART_MODEL=/models/heart.glb to use a real model instead of the procedural heart
  const glb = process.env.NEXT_PUBLIC_HEART_MODEL || "/models/heart.glb";

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = st.current;
    const fade = 1 - smooth(s.t, T_ENTER - 0.045, T_ENTER + 0.012);
    g.visible = fade > 0.01;
    g.scale.setScalar(1 + 0.038 * s.beat);
    for (const m of mats) {
      m.opacity = fade * ((m.userData.base as number | undefined) ?? 1);
      if (!m.userData.noDepth) m.depthWrite = fade > 0.98;
    }
  });

  return (
    <group ref={group} rotation={[HEART_EULER.x, HEART_EULER.y, HEART_EULER.z]}>
      {glb ? (
        <Suspense fallback={<ProceduralHeart mats={mats} />}>
          <GLBHeart url={glb} mats={mats} />
        </Suspense>
      ) : (
        <ProceduralHeart mats={mats} />
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Inside the vessel                                                   */
/* ------------------------------------------------------------------ */
function makeTissueTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n =
        noise3(u * 6, v * 6, 1) * 0.5 + noise3(u * 14, v * 14, 7) * 0.3 + noise3(u * 40, v * 40, 3) * 0.2;
      const streak = noise3(u * 3, v * 30, 9); // elongated fibres
      const val = Math.floor(255 * THREE.MathUtils.clamp(0.35 + n * 0.5 + streak * 0.25, 0, 1));
      const i = (y * size + x) * 4;
      img.data[i] = val;
      img.data[i + 1] = Math.floor(val * 0.78);
      img.data[i + 2] = Math.floor(val * 0.74);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.repeat.set(24, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Tunnel({ st }: { st: RefObject<SceneState> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { geo, mat } = useMemo(() => {
    const curve = buildTunnelCurve();
    const geo = buildTube(curve, 420, 28, (u) => {
      const wobble = 0.05 * Math.sin(u * 60) + 0.04 * Math.sin(u * 23 + 1);
      const flare = 3.2 * Math.pow(smooth(u, 0.9, 1), 2);
      return 0.62 + wobble + flare;
    });
    const tex = makeTissueTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: tex,
      bumpScale: 2.5,
      color: "#8a2f31",
      emissive: "#33090c",
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    return { geo, mat };
  }, []);

  useFrame(() => {
    const s = st.current;
    if (mesh.current) mesh.current.visible = s.t > T_ENTER - 0.035;
    mat.emissiveIntensity = 0.7 + 0.9 * s.beat;
  });

  return <mesh ref={mesh} geometry={geo} material={mat} visible={false} />;
}

/** Tube with parallel-transport frames (TubeGeometry's Frenet frames twist at tight bends). */
function buildTube(curve: THREE.Curve<THREE.Vector3>, segments: number, radial: number, radiusAt: (u: number) => number) {
  const pts = curve.getSpacedPoints(segments);
  const tans = pts.map((_, i) => pts[Math.min(i + 1, segments)].clone().sub(pts[Math.max(i - 1, 0)]).normalize());
  const n = new THREE.Vector3(0, 1, 0);
  if (Math.abs(tans[0].y) > 0.9) n.set(1, 0, 0);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = tans[i];
    n.addScaledVector(t, -n.dot(t)).normalize();
    b.crossVectors(t, n);
    const r = radiusAt(i / segments);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      dir.copy(n).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
      pos.push(pts[i].x + dir.x * r, pts[i].y + dir.y * r, pts[i].z + dir.z * r);
      uv.push(i / segments, j / radial);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const c = (i + 1) * (radial + 1) + j;
      idx.push(a, c, a + 1, c, c + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeSpriteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Drifting specks along the whole path, so the interior feels alive and gives a sense of speed. */
function Particles({ st }: { st: RefObject<SceneState> }) {
  const COUNT = 900;
  const pts = useRef<THREE.Points>(null);
  const sprite = useMemo(() => makeSpriteTexture(), []);
  const { geometry, base, phase } = useMemo(() => {
    const base = new Float32Array(COUNT * 3);
    const phase = new Float32Array(COUNT);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < COUNT; i++) {
      const idx = Math.floor((0.25 + rnd() * 0.75) * (PATH_SAMPLES.length - 1));
      const p = PATH_SAMPLES[idx];
      const inTunnel = idx / PATH_SAMPLES.length < T_TUNNEL_END;
      const r = inTunnel ? 0.05 + rnd() * 0.45 : 0.3 + rnd() * 2.6;
      const a = rnd() * Math.PI * 2;
      base[i * 3] = p.x + Math.cos(a) * r;
      base[i * 3 + 1] = p.y + Math.sin(a) * r;
      base[i * 3 + 2] = p.z + (rnd() - 0.5) * 0.5;
      phase[i] = rnd() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    return { geometry, base, phase };
  }, []);

  useFrame((state) => {
    const p = pts.current;
    if (!p) return;
    p.visible = st.current.t > T_ENTER - 0.03;
    if (!p.visible) return;
    const t = state.clock.elapsedTime;
    const arr = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      arr.setXYZ(
        i,
        base[i * 3] + Math.sin(t * 0.4 + phase[i]) * 0.06,
        base[i * 3 + 1] + Math.cos(t * 0.33 + phase[i] * 1.7) * 0.06,
        base[i * 3 + 2] + Math.sin(t * 0.2 + phase[i] * 2.3) * 0.12
      );
    }
    arr.needsUpdate = true;
  });

  return (
    <points ref={pts} geometry={geometry} visible={false}>
      <pointsMaterial
        map={sprite}
        color="#ffb7a0"
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* The three arteries, glowing in open space                          */
/* ------------------------------------------------------------------ */
type Path = { name: string; color: string; radius: number; pts: [number, number, number][]; label?: [number, number, number] };

const TREE: Path[] = [
  { name: "LM", color: "#ede8df", radius: 0.055, pts: [[1.5, 2.0, 0], [1.46, 1.4, 0.05], [1.4, 0.95, 0.1]] },
  { name: "LAD", color: "#e5484d", radius: 0.045, pts: [[1.4, 0.95, 0.1], [1.85, 0.35, 0.2], [2.08, -0.55, 0.3], [2.0, -1.6, 0.35]], label: [2.3, -1.75, 0.35] },
  { name: "LCX", color: "#3e8bff", radius: 0.04, pts: [[1.4, 0.95, 0.1], [1.0, 0.4, -0.05], [0.8, -0.4, -0.15], [0.95, -1.3, -0.2]], label: [0.95, -1.5, -0.2] },
  { name: "RCA", color: "#3db37a", radius: 0.045, pts: [[0.05, 1.95, 0], [-0.02, 1.15, 0.05], [0.24, 0.2, 0.1], [0.08, -0.7, 0.05], [0.3, -1.65, 0]], label: [0.3, -1.8, 0] },
];

function sideBranches(curve: THREE.CatmullRomCurve3, ts: number[], side: number, len: number) {
  return ts.map((t, i) => {
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const n = new THREE.Vector3(-tan.y, tan.x, 0).multiplyScalar(side * (i % 2 === 0 ? 1 : -1));
    const d = tan.clone().multiplyScalar(0.55).add(n.multiplyScalar(0.85)).normalize();
    const end = p.clone().addScaledVector(d, len * (0.8 + 0.25 * ((i * 7) % 3)));
    const mid = p.clone().addScaledVector(d, len * 0.5).add(new THREE.Vector3(0, -0.06, 0.05));
    return new THREE.CatmullRomCurve3([p, mid, end]);
  });
}

function TreeLabel({ text, color, position, st }: { text: string; color: string; position: [number, number, number]; st: RefObject<SceneState> }) {
  const sprite = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    const draw = () => {
      const g = c.getContext("2d")!;
      g.clearRect(0, 0, c.width, c.height);
      g.font = "500 60px 'JetBrains Mono Variable', ui-monospace, Menlo, Consolas, monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = color;
      g.fillText(text.split("").join(" "), 256, 68);
      t.needsUpdate = true;
    };
    draw();
    // redraw once the webfont has actually loaded, so the first frame is never a half-drawn label
    document.fonts?.ready.then(draw);
    return t;
  }, [text, color]);
  useFrame((_, dt) => {
    const m = sprite.current?.material;
    if (!m) return;
    const target = st.current.q > 0.92 ? 1 : 0;
    m.opacity += (target - m.opacity) * (1 - Math.exp(-dt * 5));
  });
  return (
    <sprite ref={sprite} position={position} scale={[1.6, 0.4, 1]} renderOrder={10}>
      <spriteMaterial
        map={tex}
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </sprite>
  );
}

function ArteryTree({ st }: { st: RefObject<SceneState> }) {
  const group = useRef<THREE.Group>(null);
  const built = useMemo(() => {
    const items = TREE.map((a, ai) => {
      const curve = new THREE.CatmullRomCurve3(a.pts.map((p) => new THREE.Vector3(...p)));
      const color = new THREE.Color(a.color).multiplyScalar(1.5);
      const R = 1.15; // thickness multiplier (the tree sits far from the camera)
      const segs = 90;
      const rad = 12;
      const parts: { geo: THREE.BufferGeometry; halo: THREE.BufferGeometry; segs: number; rad: number }[] = [];
      const add = (c: THREE.CatmullRomCurve3, r: number, s: number) =>
        parts.push({
          geo: buildTube(c, s, rad, (u) => r * R * (1 - 0.55 * u)),
          halo: buildTube(c, s, 10, (u) => r * R * 2.6 * (1 - 0.55 * u)),
          segs: s,
          rad,
        });
      add(curve, a.radius, segs);
      if (a.name !== "LM") {
        const branches = sideBranches(curve, [0.32, 0.55, 0.78], a.name === "RCA" ? 1 : ai % 2 ? 1 : -1, 0.5);
        branches.forEach((b) => add(b, a.radius * 0.45, 40));
      }
      return { a, color, parts };
    });
    return items;
  }, []);

  useFrame((state) => {
    const s = st.current;
    if (group.current) {
      group.current.visible = s.q > 0.001;
      group.current.rotation.y = -0.3 + state.pointer.x * 0.1;
    }
    built.forEach((it) => {
      // draw the trunk first, then the branches and the RCA slightly later
      const local = THREE.MathUtils.clamp((s.q - (it.a.name === "RCA" ? 0.25 : it.a.name === "LM" ? 0 : 0.15)) / 0.6, 0, 1);
      it.parts.forEach((part, pi) => {
        const q = pi === 0 ? local : THREE.MathUtils.clamp((local - 0.4) / 0.6, 0, 1);
        const rows = part.rad * 6;
        const count = Math.floor(q * part.segs) * rows;
        part.geo.setDrawRange(0, count);
        part.halo.setDrawRange(0, Math.floor(q * part.segs) * 10 * 6);
      });
    });
  });

  return (
    <group ref={group} position={[0.55, 0.05, -16.6]} visible={false}>
      {built.map((it) => (
        <group key={it.a.name}>
          {it.parts.map((p, i) => (
            <group key={i}>
              <mesh geometry={p.geo}>
                <meshBasicMaterial color={it.color} toneMapped={false} />
              </mesh>
              <mesh geometry={p.halo}>
                <meshBasicMaterial color={it.color} transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
              </mesh>
            </group>
          ))}
          {it.a.label && <TreeLabel text={it.a.name} color={it.a.color} position={it.a.label} st={st} />}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */
export default function HeartScene({ progressRef, active }: { progressRef: RefObject<number>; active: boolean }) {
  const st = useRef<SceneState>({ p: 0, t: 0, beat: 0, q: 0 });

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.6]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 45, near: 0.05, far: 60, position: [0.4, 0.5, 7.4] }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <color attach="background" args={["#0b0d0f"]} />
      <fogExp2 attach="fog" args={["#0b0d0f", 0.028]} />

      <ambientLight intensity={0.22} />
      <hemisphereLight args={["#ffd9c9", "#1b0a0c", 0.55]} />
      <directionalLight position={[3.5, 4.5, 5]} intensity={2.6} color="#fff0e6" />
      <directionalLight position={[-5, 1.5, -3]} intensity={1.6} color="#6fa8ff" />

      <Studio />
      <Rig progressRef={progressRef} st={st} />
      <Heart st={st} />
      <Tunnel st={st} />
      <Particles st={st} />
      <ArteryTree st={st} />
    </Canvas>
  );
}