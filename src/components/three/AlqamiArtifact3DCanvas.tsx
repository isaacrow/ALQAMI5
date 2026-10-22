import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { assetUrl } from '../../utils/assetUrl';

interface AlqamiArtifact3DCanvasProps {
  glbUrl: string;
  autoRotate?: boolean;
  mode?: 'embedded' | 'popout' | 'banner' | 'card';
  className?: string;
}

export const AlqamiArtifact3DCanvas: React.FC<AlqamiArtifact3DCanvasProps> = ({
  glbUrl,
  autoRotate = true,
  mode = 'embedded',
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    setLoading(true);

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    // Camera placed directly on Z-axis, centered at Y=0, looking straight at (0, 0, 0)
    camera.position.set(0, 0, mode === 'popout' ? 1.7 : mode === 'card' ? 1.55 : mode === 'banner' ? 1.6 : 1.75);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.replaceChildren(renderer.domElement);

    // Physically-based studio environment reflections for authentic gold & metals
    const pmremGen = new THREE.PMREMGenerator(renderer);
    pmremGen.compileEquirectangularShader();
    const envRoom = new RoomEnvironment();
    const envTexture = pmremGen.fromScene(envRoom, 0.04).texture;
    scene.environment = envTexture;
    pmremGen.dispose();

    // Studio Museum Lights: bright, warm key and balanced fill for true material sheen
    const ambient = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xfffbf2, 2.6);
    dirLight.position.set(2.5, 4.5, 3.5);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xf2f6ff, 1.5);
    fillLight.position.set(-3, 2, 2.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfff3e0, 1.2);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // Floor contact shadow
    const shadowGeo = new THREE.PlaneGeometry(1.8, 1.8);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.65, depthWrite: false });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.45;
    scene.add(shadowMesh);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(assetUrl('draco/'));
    loader.setDRACOLoader(dracoLoader);

    let disposed = false;

    loader.load(
      assetUrl(glbUrl),
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;

        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        // Framing scale
        const targetSize = mode === 'banner' ? 1.05 : mode === 'popout' ? 1.3 : mode === 'card' ? 0.95 : 1.15;
        const targetScale = targetSize / maxDim;

        // Create pivot group:
        const pivot = new THREE.Group();
        pivot.name = 'pivot';

        // Center root inside pivot so (0,0,0) is EXACTLY the center of the bounding box
        root.position.set(-center.x, -center.y, -center.z);
        pivot.add(root);
        pivot.scale.setScalar(targetScale);

        modelRoot.add(pivot);

        // Position shadow directly beneath the bottom of the object
        const halfY = (size.y * targetScale) / 2;
        shadowMesh.position.y = -halfY - 0.02;
        const horizRadius = Math.max(size.x, size.z) * targetScale * 0.85;
        shadowMesh.scale.set(Math.max(0.7, horizRadius * 1.8), Math.max(0.7, horizRadius * 1.8), 1);

        setLoading(false);
        renderer.render(scene, camera);
      },
      undefined,
      (err) => {
        if (disposed) return;
        console.warn('Failed to load GLTF model:', glbUrl, err);
        const fallbackGeo = new THREE.BoxGeometry(0.7, 0.45, 0.1);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xc8aa78, roughness: 0.5, metalness: 0.1 });
        modelRoot.add(new THREE.Mesh(fallbackGeo, fallbackMat));
        setLoading(false);
        renderer.render(scene, camera);
      }
    );

    // Pointer Interaction & Touch Control
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let baseRotX = 0.14;
    let baseRotY = 0.35;
    let curRotX = baseRotX;
    let curRotY = baseRotY;
    let parallaxX = 0;
    let parallaxY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture exceptions
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) {
        if (modeRef.current === 'banner') {
          // Subtle mouse hover parallax
          const rect = container.getBoundingClientRect();
          parallaxY = ((e.clientX - rect.left) / rect.width - 0.5) * 0.45;
          parallaxX = ((e.clientY - rect.top) / rect.height - 0.5) * 0.25;
        }
        return;
      }
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;

      baseRotY += dx * 0.015;
      baseRotX = Math.max(-1.25, Math.min(1.25, baseRotX + dy * 0.015));
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);

    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || 480;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    let reqId = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const time = performance.now() * 0.001;

      if (modeRef.current === 'card') {
        curRotY += (baseRotY - curRotY) * 0.12;
        curRotX += (baseRotX - curRotX) * 0.12;
        modelRoot.rotation.y = curRotY;
        modelRoot.rotation.x = curRotX;
        renderer.render(scene, camera);
        return;
      }

      if (modeRef.current === 'banner') {
        // Continuous organic floating & random moving in the blue banner
        modelRoot.position.y = Math.sin(time * 1.6) * 0.06 + Math.cos(time * 2.3) * 0.03;
        modelRoot.position.x = Math.sin(time * 1.2) * 0.035;
        const organicYaw = Math.sin(time * 0.8) * 0.38 + Math.cos(time * 0.45) * 0.28;
        const organicPitch = Math.sin(time * 1.1) * 0.12;
        const organicRoll = Math.sin(time * 0.9) * 0.07;

        curRotY += (baseRotY + organicYaw + parallaxY - curRotY) * 0.12;
        curRotX += (baseRotX + organicPitch + parallaxX - curRotX) * 0.12;

        modelRoot.rotation.y = curRotY;
        modelRoot.rotation.x = curRotX;
        modelRoot.rotation.z = organicRoll;
      } else {
        if (autoRotateRef.current && !isDragging) {
          // Slow, graceful museum turntable rotation (approx 1/3 speed, silky smooth)
          baseRotY += 0.0022;
        }
        // Silky smooth damping
        curRotX += (baseRotX - curRotX) * 0.06;
        curRotY += (baseRotY - curRotY) * 0.06;
        modelRoot.rotation.x = curRotX;
        modelRoot.rotation.y = curRotY;
      }

      renderer.render(scene, camera);
    };
    reqId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(reqId);
      ro.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      envTexture.dispose();
      renderer.dispose();
      dracoLoader.dispose();
    };
  }, [glbUrl, mode]);

  return (
    <div className={`relative w-full h-full flex items-center justify-center select-none pointer-events-auto ${className}`}>
      <div ref={mountRef} className="w-full h-full touch-none cursor-grab active:cursor-grabbing pointer-events-auto" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-sm pointer-events-none">
          <div className="w-7 h-7 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-1.5" />
          <span className="text-[10px] font-mono text-white/80">Loading 3D...</span>
        </div>
      )}
    </div>
  );
};
