'use client';

/**
 * Simulator 3D isometrik (three.js via @react-three/fiber). Dimuat dinamis tanpa SSR.
 * - Container/zona = kotak transparan bergaris tebal.
 * - Kemasan = SATU InstancedMesh (≥ 30 fps untuk ±1.200 karung); slider "isi %" cukup mengubah mesh.count.
 * - Sumbu engine (x panjang, y lebar, z tinggi) → three (x, z, y) dengan y ke atas.
 * Representasi grid, bukan posisi fisik eksak (ADR-005).
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { NestedColumn, Placement } from '@gemas/calc-engine';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const INK = new THREE.Color('#0E1A1F');
const ACID = new THREE.Color('#63E6CF');
const SAFETY = new THREE.Color('#F5A524');

declare global {
  interface Window {
    /** Diisi saat render 3D berjalan — dibaca uji E2E (fps). */
    __gemasSim3d?: { fps: number; instances: number; visible: number; frames: number };
  }
}

function Controls({ target }: { target: THREE.Vector3 }) {
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.target.copy(target);
    c.enableDamping = true;
    c.update();
    const onChange = () => invalidate();
    c.addEventListener('change', onChange);
    let raf = 0;
    const tick = () => {
      c.update();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener('change', onChange);
      c.dispose();
    };
  }, [camera, gl, invalidate, target]);
  return null;
}

/** Ukur fps sederhana & ekspos ke window untuk E2E. */
function FpsProbe({ instances, visible }: { instances: number; visible: number }) {
  const acc = useRef({ t: 0, n: 0, frames: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt;
    a.n += 1;
    a.frames += 1;
    if (a.t >= 0.5) {
      window.__gemasSim3d = { fps: a.n / a.t, instances, visible, frames: a.frames };
      a.t = 0;
      a.n = 0;
    }
  });
  return null;
}

function ContainerBox({ L, W, H }: { L: number; W: number; H: number }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)), [L, W, H]);
  return (
    <group position={[L / 2, H / 2, W / 2]}>
      <mesh>
        <boxGeometry args={[L, H, W]} />
        <meshBasicMaterial color="#F3F6F7" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={INK} />
      </lineSegments>
    </group>
  );
}

function Packs({ placements, visible }: { placements: Placement[]; visible: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const maxZ = useMemo(() => placements.reduce((m, p) => Math.max(m, p.z), 0), [placements]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    placements.forEach((p, i) => {
      v.set(p.x + p.l / 2, p.z + p.h / 2, p.y + p.w / 2);
      s.set(p.l * 0.94, p.h * 0.94, p.w * 0.94);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
      // Lapisan atas sedikit lebih terang agar tumpukan terbaca.
      c.copy(ACID).lerp(SAFETY, maxZ > 0 ? (p.z / maxZ) * 0.2 : 0);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [placements, maxZ]);
  useEffect(() => {
    if (ref.current) ref.current.count = visible;
  }, [visible]);
  if (!placements.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, placements.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

function BulkFill({ L, W, H, level }: { L: number; W: number; H: number; level: number }) {
  const h = Math.max(0.0001, H * level);
  return (
    <mesh position={[L / 2, h / 2, W / 2]}>
      <boxGeometry args={[L * 0.995, h, W * 0.995]} />
      <meshLambertMaterial color={ACID} />
    </mesh>
  );
}

function Columns({ columns }: { columns: NestedColumn[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const v = new THREE.Vector3();
    columns.forEach((c, i) => {
      v.set(c.x + c.l / 2, c.heightM / 2, c.y + c.w / 2);
      s.set(c.l * 0.45, c.heightM, c.w * 0.45);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [columns]);
  if (!columns.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, columns.length]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 16]} />
      <meshLambertMaterial color={INK} />
    </instancedMesh>
  );
}

export interface Sim3DProps {
  space: { L: number; W: number; H: number };
  placements?: Placement[];
  visible?: number;
  bulkLevel?: number;
  columns?: NestedColumn[];
}

export default function Sim3D({ space, placements = [], visible = placements.length, bulkLevel, columns = [] }: Sim3DProps) {
  const { L, W, H } = space;
  const span = Math.max(L, W, H);
  const target = useMemo(() => new THREE.Vector3(L / 2, H / 3, W / 2), [L, W, H]);
  return (
    <div className="relative h-[360px] w-full border-3 border-ink bg-paper sm:h-[440px]" data-testid="sim-3d">
      <Canvas
        orthographic
        dpr={[1, 2]}
        camera={{ position: [L / 2 + span, H + span * 0.9, W / 2 + span], zoom: 900 / (span * 1.6), near: -100, far: 1000 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[span, span * 2, span * 0.6]} intensity={0.9} />
        <ContainerBox L={L} W={W} H={H} />
        <Packs placements={placements} visible={visible} />
        {bulkLevel !== undefined && <BulkFill L={L} W={W} H={H} level={bulkLevel} />}
        <Columns columns={columns} />
        <gridHelper args={[span * 1.4, 14, INK, '#E2E8EA']} position={[L / 2, 0, W / 2]} />
        <Controls target={target} />
        <FpsProbe instances={placements.length + columns.length} visible={visible} />
      </Canvas>
      <span className="pointer-events-none absolute left-2 top-2 bg-ink px-2 py-1 font-mono text-[11px] font-bold text-acid">
        3D · geser untuk memutar
      </span>
    </div>
  );
}
