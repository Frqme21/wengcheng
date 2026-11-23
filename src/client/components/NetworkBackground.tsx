import { useEffect, useRef } from "react";
import * as THREE from "three";
import { oklchToRgb } from "../lib/color";
import { debounce, prefersReduced } from "../lib/motion";
import { scrollState } from "../lib/lenis";

const N = 120;
const HOSTILE = 22;
const LINK = 2.1;
const MAX_SEG = 700;

/** Connected-line topology. Orange nodes drift into the courtyard ring as you scroll. */
export default function NetworkBackground({ onReady }: { onReady: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = prefersReduced();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      onReady();
      return;
    }

    const base = oklchToRgb("oklch(0.76 0.07 235)", [0.5, 0.7, 0.85]);
    const hot = oklchToRgb("oklch(0.72 0.17 45)", [0.99, 0.45, 0.3]);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const ang = new Float32Array(HOSTILE);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
      vel[i * 3] = (Math.random() - 0.5) * 0.25;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
      const c = i < HOSTILE ? hot : base;
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
      if (i < HOSTILE) ang[i] = Math.random() * Math.PI * 2;
    }

    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pointGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pointMat = new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true });
    const points = new THREE.Points(pointGeo, pointMat);

    const linePos = new Float32Array(MAX_SEG * 6);
    const lineCol = new Float32Array(MAX_SEG * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
    lineGeo.setDrawRange(0, 0);
    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1 });
    const lines = new THREE.LineSegments(lineGeo, lineMat);

    // The courtyard ring: two concentric loops the hostile nodes orbit
    const ringGroup = new THREE.Group();
    const ringMats: THREE.LineBasicMaterial[] = [];
    const ringGeos: THREE.BufferGeometry[] = [];
    [1.7, 1.15].forEach((r, i) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({ color: new THREE.Color(hot[0], hot[1], hot[2]), transparent: true, opacity: i === 0 ? 0.4 : 0.22 });
      ringGeos.push(g);
      ringMats.push(m);
      ringGroup.add(new THREE.Line(g, m));
    });

    const world = new THREE.Group();
    world.add(points, lines, ringGroup);
    scene.add(world);

    let ringX = 3.4;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      ringX = Math.min(3.4, (w / h) * 2.1);
      ringGroup.position.set(ringX, -0.3, 0);
    };
    resize();
    const onResize = debounce(() => {
      resize();
      if (reduced) renderer.render(scene, camera);
    }, 150);
    window.addEventListener("resize", onResize);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!reduced) window.addEventListener("pointermove", onMove, { passive: true });

    const step = (dt: number, t: number) => {
      const pull = 0.25 + scrollState.progress * 2.2;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        if (i < HOSTILE) {
          ang[i] += dt * (0.25 + (i % 5) * 0.06);
          const rad = i % 2 ? 1.7 : 1.15;
          const tx = ringX + Math.cos(ang[i]) * rad;
          const ty = -0.3 + Math.sin(ang[i]) * rad;
          const f = Math.min(1, dt * pull);
          pos[k] += (tx - pos[k]) * f + vel[k] * dt * (1 - Math.min(1, pull * 0.35));
          pos[k + 1] += (ty - pos[k + 1]) * f + vel[k + 1] * dt * (1 - Math.min(1, pull * 0.35));
          pos[k + 2] += (0 - pos[k + 2]) * f * 0.6;
        } else {
          pos[k] += vel[k] * dt;
          pos[k + 1] += vel[k + 1] * dt;
          pos[k + 2] += vel[k + 2] * dt;
          if (Math.abs(pos[k]) > 8) vel[k] *= -1;
          if (Math.abs(pos[k + 1]) > 4.6) vel[k + 1] *= -1;
          if (Math.abs(pos[k + 2]) > 3) vel[k + 2] *= -1;
        }
      }

      let s = 0;
      const lim = LINK * LINK;
      for (let i = 0; i < N && s < MAX_SEG; i++) {
        for (let j = i + 1; j < N && s < MAX_SEG; j++) {
          const dx = pos[i * 3] - pos[j * 3];
          const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
          const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < lim) {
            const a = (1 - Math.sqrt(d2) / LINK) * 0.5;
            const c = i < HOSTILE && j < HOSTILE ? hot : base;
            const o = s * 6;
            linePos[o] = pos[i * 3];
            linePos[o + 1] = pos[i * 3 + 1];
            linePos[o + 2] = pos[i * 3 + 2];
            linePos[o + 3] = pos[j * 3];
            linePos[o + 4] = pos[j * 3 + 1];
            linePos[o + 5] = pos[j * 3 + 2];
            lineCol[o] = lineCol[o + 3] = c[0] * a;
            lineCol[o + 1] = lineCol[o + 4] = c[1] * a;
            lineCol[o + 2] = lineCol[o + 5] = c[2] * a;
            s++;
          }
        }
      }
      lineGeo.setDrawRange(0, s * 2);
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;
      pointGeo.attributes.position.needsUpdate = true;

      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      const p = scrollState.progress;
      camera.position.x = mouse.x * 0.6 - p * 1.2;
      camera.position.y = -mouse.y * 0.4 - p * 1.4;
      camera.position.z = 8 - p * 2.5;
      camera.lookAt(0, 0, 0);
      world.rotation.y = Math.sin(t * 0.07) * 0.12 + p * 0.5;
      ringGroup.rotation.z = t * 0.05 + scrollState.velocity * 0.01;
      ringMats[0].opacity = 0.3 + Math.min(0.4, Math.abs(scrollState.velocity) * 0.02) + p * 0.2;
    };

    // Compile shaders and upload buffers before reporting ready
    step(0.016, 0);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    onReady();

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt, now / 1000);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      onResize.cancel();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      pointGeo.dispose();
      pointMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      ringGeos.forEach((g) => g.dispose());
      ringMats.forEach((m) => m.dispose());
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-80" />;
}
