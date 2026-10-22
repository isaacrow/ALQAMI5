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
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.replaceChildren(renderer.domElement);

    // Realistic PBR Environment Map (from RoomEnvironment for glowing metallic/gold reflections)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    scene.environment = roomEnv;

    // Enhanced Museum Studio Lighting (Warm Key, Cool Fill, Gold Specular Highlights)
    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfffaec, 2.8);
    keyLight.position.set(2.5, 4.5, 3.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb2d2ff, 1.5);
    fillLight.position.set(-3.5, 2.0, 2.0);
    scene.add(fillLight);

    const goldAccentLight = new THREE.DirectionalLight(0xffdf80, 1.6);
    goldAccentLight.position.set(0, 3.5, -3.0);
    scene.add(goldAccentLight);

    const pointLight = new THREE.PointLight(0xffe6a3, 1.5, 6);
    pointLight.position.set(0, 0.8, 1.5);
    scene.add(pointLight);

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
    if (mode !== 'banner') { scene.add(shadowMesh); }

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    let disposed = false;

    loader.load(
      assetUrl(glbUrl),
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;

        root.updateMatrixWorld(true);
        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat) => {
                if ('envMapIntensity' in mat) {
                  (mat as THREE.MeshStandardMaterial).envMapIntensity = 1.45;
                }
                if ('roughness' in mat && typeof (mat as THREE.MeshStandardMaterial).roughness === 'number') {
                  const m = mat as THREE.MeshStandardMaterial;
                  if (m.metalness > 0.3) {
                    m.roughness = Math.max(0.12, m.roughness * 0.9);
                  }
                }
                mat.needsUpdate = true;
              });
            }
          }
        });
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

      baseRotY += dx * 0.007;
      baseRotX = Math.max(-1.25, Math.min(1.25, baseRotX + dy * 0.007));
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
      if (modeRef.current === 'card') {
        if (isDragging) {
          curRotY += (baseRotY - curRotY) * 0.15;
          curRotX += (baseRotX - curRotX) * 0.15;
          modelRoot.rotation.y = curRotY;
          modelRoot.rotation.x = curRotX;
          renderer.render(scene, camera);
        }
        return;
      }

      if (modeRef.current === 'banner') {
        modelRoot.position.set(0, 0, 0);
        modelRoot.rotation.x = 0.12;
        modelRoot.rotation.z = 0;
        baseRotY += 0.0028;
        curRotY += (baseRotY + parallaxY - curRotY) * 0.045;
        modelRoot.rotation.y = curRotY;
      } else {
        if (autoRotateRef.current && !isDragging) baseRotY += 0.0022;
        curRotX += (baseRotX - curRotX) * 0.045;
        curRotY += (baseRotY - curRotY) * 0.045;
        modelRoot.rotation.x = curRotX;
        modelRoot.rotation.y = curRotY;
      }

      renderer.render(scene, camera);
    };
    reqId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      pmremGenerator.dispose();
      roomEnv.dispose();
      cancelAnimationFrame(reqId);
      ro.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
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
