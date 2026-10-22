import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  X,
  Scan,
  Box,
  Sparkles,
  Check,
  ArrowRight,
  ShieldCheck,
  Compass,
  Download,
  Copy,
  Layers,
  Sliders,
  RotateCw,
  Plus,
  Eye,
  FileCode,
  CheckCircle2,
  Maximize2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  getAllReferenceObjects,
  getArtifactRdfMetadata,
  RdfParsedMetadata,
  ScannedReferenceObject,
  saveCustomScannedObject,
  exportArObjectBlob,
  generateCustomTurtle,
} from '../../utils/alqamiRdfStore';
import { spatialSound } from '../../utils/spatialSound';
import { ALQAMI_ARTIFACTS, AlqamiArtifact } from '../../data/alqamiArtifacts';

interface AlqamiARKitObjectScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployInSpace?: (artifact: AlqamiArtifact) => void;
  onOpenDetail?: (artifact: AlqamiArtifact) => void;
  initialMode?: 'detect' | 'scan';
}

export const AlqamiARKitObjectScanner: React.FC<AlqamiARKitObjectScannerProps> = ({
  isOpen,
  onClose,
  onDeployInSpace,
  onOpenDetail,
  initialMode = 'scan',
}) => {
  // Modes: 'detect' (Apple ARKit Object Detection & RDF Recall) | 'scan' (Apple ARKit Object Scanning & Give Metadata)
  const [activeMode, setActiveMode] = useState<'detect' | 'scan'>(initialMode);

  // Detection state
  const referenceObjects = getAllReferenceObjects();
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [activeRdfTab, setActiveRdfTab] = useState<'summary' | 'transcription' | 'turtle' | 'bibframe'>('summary');
  const [confidence, setConfidence] = useState(0.96);
  const [copiedRdf, setCopiedRdf] = useState(false);
  const [isLockedOnObject, setIsLockedOnObject] = useState(true);

  // Scanning state (Apple ARKit ARObjectScanning steps 1 to 5)
  // Step 1: Position & Bounding Box
  // Step 2: 360° Scan Coverage
  // Step 3: Adjust Origin
  // Step 4: Give Metadata (RDF)
  // Step 5: Test & Export (.arobject)
  const [scanStep, setScanStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [boxDimensions, setBoxDimensions] = useState({ widthCm: 22.0, heightCm: 28.5, depthCm: 22.0 });
  const [boxOffset, setBoxOffset] = useState({ x: 0, y: 0, z: -0.8 });
  const [originOffset, setOriginOffset] = useState({ x: 0, y: -0.14, z: 0 });
  const [scanCoverage, setScanCoverage] = useState({ front: 0, right: 0, back: 0, left: 0, top: 0 });
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [featurePointsCount, setFeaturePointsCount] = useState(380);

  // Custom Metadata Form
  const [customForm, setCustomForm] = useState({
    scanName: 'My Scanned Heritage Artifact',
    titleAr: '',
    titleEn: '',
    creatorAr: '',
    date: 'العصر الإسلامي',
    materialsAr: 'معدن مطروق، فضة، ذهب',
    dimensions: '22 × 28 × 22 سم',
    transcriptionAr: '',
    selectedBaseArtifactId: 'ALQ-ARM-001',
  });

  const [savedSuccessToast, setSavedSuccessToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
      if (initialMode === 'scan') {
        setScanStep(2);
        setIsScanningActive(true);
      }
    }
  }, [isOpen, initialMode]);

  // Video and Three.js 3D Viewport refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const threeMountRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const boundingBoxGroupRef = useRef<THREE.Group | null>(null);
  const pointCloudRef = useRef<THREE.Points | null>(null);
  const originAxesRef = useRef<THREE.Group | null>(null);

  const activeTarget = referenceObjects[selectedTargetIndex] || referenceObjects[0];

  // Camera stream setup
  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let active = true;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Physical camera unavailable, using spatial camera simulator:', err);
      }
    }

    initCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  // Three.js Interactive 3D Bounding Box & Point Cloud Setup
  useEffect(() => {
    if (!isOpen || !threeMountRef.current) return;

    const container = threeMountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.05, 50);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // Subtle studio lights for 3D bounding gizmos
    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xfff5e6, 2.5);
    dir.position.set(2, 3, 2);
    scene.add(dir);

    // ── 3D Bounding Box Group ──
    const bboxGroup = new THREE.Group();
    scene.add(bboxGroup);
    boundingBoxGroupRef.current = bboxGroup;

    // Outer wireframe box
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.name = 'boxMesh';
    bboxGroup.add(boxMesh);

    // Translucent glass faces
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.08,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const glassMesh = new THREE.Mesh(boxGeo, glassMat);
    glassMesh.name = 'glassMesh';
    bboxGroup.add(glassMesh);

    // Corner brackets (Apple ARKit style)
    const cornersGroup = new THREE.Group();
    cornersGroup.name = 'cornersGroup';
    bboxGroup.add(cornersGroup);

    // Point Cloud (Simulated ARKit Spatial Feature Points)
    const ptsCount = 650;
    const ptsPositions = new Float32Array(ptsCount * 3);
    const ptsColors = new Float32Array(ptsCount * 3);
    const colorAmber = new THREE.Color(0xfbbf24);
    const colorCyan = new THREE.Color(0x00f5d4);

    for (let i = 0; i < ptsCount; i++) {
      // Clustered inside and around the bounding box
      ptsPositions[i * 3 + 0] = (Math.random() - 0.5) * 0.9;
      ptsPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.9;
      ptsPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.9;

      const c = Math.random() > 0.4 ? colorCyan : colorAmber;
      ptsColors[i * 3 + 0] = c.r;
      ptsColors[i * 3 + 1] = c.g;
      ptsColors[i * 3 + 2] = c.b;
    }

    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute('position', new THREE.BufferAttribute(ptsPositions, 3));
    ptsGeo.setAttribute('color', new THREE.BufferAttribute(ptsColors, 3));
    const ptsMat = new THREE.PointsMaterial({
      size: 5.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const pointCloud = new THREE.Points(ptsGeo, ptsMat);
    bboxGroup.add(pointCloud);
    pointCloudRef.current = pointCloud;

    // Origin Axes Gizmo (Red X, Green Y, Blue Z)
    const axesGroup = new THREE.Group();
    axesGroup.name = 'axesGroup';
    const axisX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 0.12, 0xef4444, 0.03, 0.02);
    const axisY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 0.12, 0x10b981, 0.03, 0.02);
    const axisZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 0.12, 0x3b82f6, 0.03, 0.02);
    const originSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    axesGroup.add(axisX, axisY, axisZ, originSphere);
    bboxGroup.add(axesGroup);
    originAxesRef.current = axesGroup;

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!container) return;
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(container);

    let disposed = false;

    // Main 3D Render Loop
    const animate = () => {
      if (disposed) return;
      animFrameRef.current = requestAnimationFrame(animate);

      const time = performance.now() * 0.001;

      // Pulse feature points
      if (pointCloudRef.current) {
        pointCloudRef.current.rotation.y = Math.sin(time * 0.3) * 0.08;
      }

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      renderer.dispose();
    };
  }, [isOpen]);

  // Synchronize 3D Bounding Box size and position
  useEffect(() => {
    if (!boundingBoxGroupRef.current) return;
    const group = boundingBoxGroupRef.current;

    // Convert cm to meters
    const sx = boxDimensions.widthCm / 100;
    const sy = boxDimensions.heightCm / 100;
    const sz = boxDimensions.depthCm / 100;

    const boxMesh = group.getObjectByName('boxMesh');
    const glassMesh = group.getObjectByName('glassMesh');

    if (boxMesh) boxMesh.scale.set(sx, sy, sz);
    if (glassMesh) glassMesh.scale.set(sx, sy, sz);

    group.position.set(boxOffset.x, boxOffset.y, boxOffset.z);

    if (originAxesRef.current) {
      originAxesRef.current.position.set(originOffset.x, originOffset.y, originOffset.z);
    }
  }, [boxDimensions, boxOffset, originOffset]);

  // Simulated 360° Scan Progression in Scan Mode
  useEffect(() => {
    if (activeMode !== 'scan' || scanStep !== 2 || !isScanningActive) return;

    const interval = window.setInterval(() => {
      setScanCoverage((prev) => {
        const nextFront = Math.min(100, prev.front + 8);
        const nextRight = prev.front > 40 ? Math.min(100, prev.right + 7) : prev.right;
        const nextBack = prev.right > 50 ? Math.min(100, prev.back + 6) : prev.back;
        const nextLeft = prev.back > 40 ? Math.min(100, prev.left + 8) : prev.left;
        const nextTop = prev.left > 30 ? Math.min(100, prev.top + 9) : prev.top;

        setFeaturePointsCount((c) => c + 25);
        spatialSound.playSnap?.(0.15);

        if (nextFront >= 100 && nextRight >= 100 && nextBack >= 100 && nextLeft >= 100 && nextTop >= 100) {
          window.clearInterval(interval);
          setIsScanningActive(false);
          spatialSound.playSuccess?.();
          setScanStep(3); // proceed to adjust origin
        }

        return {
          front: nextFront,
          right: nextRight,
          back: nextBack,
          left: nextLeft,
          top: nextTop,
        };
      });
    }, 450);

    return () => window.clearInterval(interval);
  }, [activeMode, scanStep, isScanningActive]);

  // Copy Turtle / RDF Code
  const handleCopyCode = () => {
    const code = activeTarget.metadata.rawTtl || activeTarget.metadata.rawRdf || '';
    navigator.clipboard.writeText(code);
    setCopiedRdf(true);
    spatialSound.playPinchTap?.();
    window.setTimeout(() => setCopiedRdf(false), 2000);
  };

  // Download .ttl or .rdf file
  const handleDownloadRdf = () => {
    const code = activeTarget.metadata.rawTtl || activeTarget.metadata.rawRdf || '';
    const blob = new Blob([code], { type: 'text/turtle;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTarget.slug}-ontology.ttl`;
    a.click();
    URL.revokeObjectURL(url);
    spatialSound.playPinchTap?.();
  };

  // Save new custom scanned object to registry & download .arobject file
  const handleSaveScannedObject = () => {
    const newTtl = generateCustomTurtle({
      titleAr: customForm.titleAr || customForm.scanName,
      titleEn: customForm.titleEn,
      creatorAr: customForm.creatorAr,
      date: customForm.date,
      materialsAr: customForm.materialsAr,
      dimensions: customForm.dimensions,
      transcriptionAr: customForm.transcriptionAr,
    });

    const baseMeta = getArtifactRdfMetadata(customForm.selectedBaseArtifactId);

    const newObj: ScannedReferenceObject = {
      id: `ALQ-CUSTOM-${Date.now()}`,
      scanName: customForm.scanName,
      timestamp: Date.now(),
      boundingBox: boxDimensions,
      origin: originOffset,
      featurePointsCount,
      coverageScore: 0.96,
      metadata: {
        ...baseMeta,
        titleAr: customForm.titleAr || customForm.scanName,
        titleEn: customForm.titleEn || customForm.scanName,
        creatorAr: customForm.creatorAr || 'حرفي غير معروف',
        date: customForm.date,
        materialsAr: customForm.materialsAr,
        dimensions: customForm.dimensions,
        transcriptionAr: customForm.transcriptionAr,
        rawTtl: newTtl,
      },
      glbModel: baseMeta.glbModel || '/models/Old_Islamic_Helmet.glb',
      customRdfTurtle: newTtl,
    };

    saveCustomScannedObject(newObj);

    // Export .arobject file
    const arBlob = exportArObjectBlob(newObj);
    const url = URL.createObjectURL(arBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customForm.scanName.replace(/\s+/g, '_')}.arobject`;
    a.click();
    URL.revokeObjectURL(url);

    setSavedSuccessToast(true);
    spatialSound.playSuccess?.();
    window.setTimeout(() => {
      setSavedSuccessToast(false);
      setActiveMode('detect');
      setSelectedTargetIndex(0);
    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[88] bg-black/92 backdrop-blur-2xl flex flex-col justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200">
      {/* ── TOP HEADER / MODE SWITCHER ── */}
      <div className="flex items-center justify-between z-20 gap-3">
        {/* Apple ARKit Branding Badge */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full vision-glass border border-emerald-400/40 text-xs font-semibold text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]">
          <Scan className="w-4 h-4 animate-pulse text-emerald-300" />
          <span>Apple ARKit 3D Object Scanner & RDF Recall</span>
        </div>

        {/* Mode Selector Toggle: Detect vs Scan */}
        <div className="flex items-center gap-1 p-1 rounded-full vision-glass border border-white/20 bg-black/40">
          <button
            onClick={() => {
              spatialSound.playPinchTap?.();
              setActiveMode('detect');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'detect'
                ? 'bg-emerald-400 text-black shadow-md font-bold'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>كشف واسترجاع RDF (Detect & Recall)</span>
          </button>

          <button
            onClick={() => {
              spatialSound.playPinchTap?.();
              setActiveMode('scan');
              setScanStep(1);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'scan'
                ? 'bg-amber-400 text-black shadow-md font-bold'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>مسح وتوثيق جديد (ARKit Scan 3D)</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full vision-glass border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition cursor-pointer active:scale-95"
          title="Close Scanner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── CENTER VIEWPORT (VIDEO PASSTHROUGH + THREE.JS 3D BOUNDING BOX) ── */}
      <div className="relative flex-1 my-2 rounded-[28px] overflow-hidden border border-white/20 bg-black/60 flex items-center justify-center">
        {/* Real camera video */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover pointer-events-none"
        />

        {/* Interactive Three.js 3D Canvas Mount (3D Bounding Box, Point Cloud, Origin Axes) */}
        <div ref={threeMountRef} className="absolute inset-0 w-full h-full pointer-events-auto" />

        {/* ── HOVERING 3D METADATA CARD (HOVERS OVER THE REAL ARTIFACT) ── */}
        {activeMode === 'detect' && isLockedOnObject && (
          <div
            dir="rtl"
            style={{
              transform: 'translate(-50%, -60%)',
            }}
            className="absolute top-1/2 left-1/2 z-30 w-[min(480px,92vw)] p-4 sm:p-5 rounded-[26px] vision-glass border border-emerald-400/60 bg-[#0a1324]/90 shadow-[0_20px_50px_rgba(0,0,0,0.85)] space-y-3.5 animate-in zoom-in-95 duration-200 pointer-events-auto"
          >
            {/* Hover Header with Live Confidence */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-400/20 border border-emerald-400 flex items-center justify-center text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {activeTarget.metadata.titleAr}
                  </h3>
                  <span className="text-[10px] text-white/70 font-sans">
                    {activeTarget.metadata.titleEn}
                  </span>
                </div>
              </div>

              <div className="text-left font-mono">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  {Math.round(confidence * 100)}% ARKit Match
                </span>
                <div className="text-[9px] text-white/50 pt-0.5">
                  {activeTarget.defaultBox.widthCm}×{activeTarget.defaultBox.heightCm}×{activeTarget.defaultBox.depthCm} cm
                </div>
              </div>
            </div>

            {/* RDF Navigation Tabs */}
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/10 text-[11px] font-semibold">
              <button
                onClick={() => setActiveRdfTab('summary')}
                className={`flex-1 py-1 rounded-lg transition ${
                  activeRdfTab === 'summary' ? 'bg-emerald-400 text-black font-bold' : 'text-white/70 hover:text-white'
                }`}
              >
                ملخص الوصف
              </button>
              <button
                onClick={() => setActiveRdfTab('transcription')}
                className={`flex-1 py-1 rounded-lg transition ${
                  activeRdfTab === 'transcription' ? 'bg-emerald-400 text-black font-bold' : 'text-white/70 hover:text-white'
                }`}
              >
                النص التراثي
              </button>
              <button
                onClick={() => setActiveRdfTab('turtle')}
                className={`flex-1 py-1 rounded-lg transition flex items-center justify-center gap-1 ${
                  activeRdfTab === 'turtle' ? 'bg-emerald-400 text-black font-bold' : 'text-white/70 hover:text-white'
                }`}
              >
                <FileCode className="w-3 h-3" />
                <span>W3C Turtle</span>
              </button>
            </div>

            {/* Tab 1: Summary */}
            {activeRdfTab === 'summary' && (
              <div className="space-y-2 text-xs text-white/85">
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/5 p-2.5 rounded-xl border border-white/10">
                  <div>
                    <span className="text-white/50 block">المؤلف / الصانع:</span>
                    <span className="font-semibold text-amber-200">{activeTarget.metadata.creatorAr}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block">التاريخ / العصر:</span>
                    <span className="font-semibold text-emerald-200">{activeTarget.metadata.date}</span>
                  </div>
                  <div>
                    <span className="text-white/50 block">المادة والأبعاد:</span>
                    <span>{activeTarget.metadata.materialsAr} ({activeTarget.metadata.dimensions})</span>
                  </div>
                  <div>
                    <span className="text-white/50 block">مكان الحفظ / المستودع:</span>
                    <span className="truncate block">{activeTarget.metadata.publisherAr}</span>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-cyan-300/90 truncate bg-cyan-950/40 p-1.5 rounded-lg border border-cyan-800/40">
                  URI: &lt;{activeTarget.metadata.uri}&gt;
                </div>
              </div>
            )}

            {/* Tab 2: Transcription */}
            {activeRdfTab === 'transcription' && (
              <div className="max-h-36 overflow-y-auto custom-scrollbar p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-amber-100/95 leading-relaxed font-serif">
                {activeTarget.metadata.transcriptionAr}
              </div>
            )}

            {/* Tab 3: Raw RDF / Turtle Code */}
            {activeRdfTab === 'turtle' && (
              <div className="relative">
                <pre className="max-h-40 overflow-y-auto text-left custom-scrollbar p-2.5 rounded-xl bg-black/80 border border-white/15 text-[10px] font-mono text-emerald-300 leading-tight">
                  {activeTarget.metadata.rawTtl}
                </pre>
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[10px] font-mono flex items-center gap-1 transition"
                  >
                    {copiedRdf ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedRdf ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                  <button
                    onClick={handleDownloadRdf}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[10px] font-mono flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3" />
                    <span>تحميل .ttl</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Actions: Deploy 3D Twin & Open Catalog */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/10">
              <button
                onClick={() => {
                  spatialSound.playPinchTap?.();
                  const matchingArtifact = ALQAMI_ARTIFACTS.find((a) => a.id === activeTarget.id) || ALQAMI_ARTIFACTS[0];
                  onDeployInSpace?.(matchingArtifact);
                  onClose();
                }}
                className="flex-1 py-2 px-3.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <Box className="w-4 h-4" />
                <span>انشر النسخة ثلاثية الأبعاد (Deploy 3D Replica)</span>
              </button>

              <button
                onClick={() => {
                  spatialSound.playPinchTap?.();
                  const matchingArtifact = ALQAMI_ARTIFACTS.find((a) => a.id === activeTarget.id) || ALQAMI_ARTIFACTS[0];
                  onOpenDetail?.(matchingArtifact);
                  onClose();
                }}
                className="py-2 px-3.5 rounded-full vision-glass border border-white/20 text-white hover:bg-white/15 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
              >
                <span>تفاصيل القطعة</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* ── SCAN MODE OVERLAY (APPLE ARKit STEP-BY-STEP WORKFLOW) ── */}
        {activeMode === 'scan' && (
          <div className="absolute top-4 left-4 right-4 z-20 flex flex-col items-center">
            {/* Step Indicators */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full vision-glass border border-amber-400/40 bg-black/70 text-xs text-white">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${scanStep >= 1 ? 'bg-amber-400 text-black' : 'bg-white/20'}`}>1</span>
              <span>تحديد الصندوق</span>
              <span className="text-white/30">›</span>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${scanStep >= 2 ? 'bg-amber-400 text-black' : 'bg-white/20'}`}>2</span>
              <span>المسح المحيطي</span>
              <span className="text-white/30">›</span>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${scanStep >= 3 ? 'bg-amber-400 text-black' : 'bg-white/20'}`}>3</span>
              <span>نقطة الارتكاز</span>
              <span className="text-white/30">›</span>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${scanStep >= 4 ? 'bg-amber-400 text-black' : 'bg-white/20'}`}>4</span>
              <span>توثيق RDF</span>
            </div>

            {/* Step Guidance Message */}
            <div className="mt-2 px-4 py-1.5 rounded-xl vision-glass border border-white/15 bg-black/50 text-[11px] text-amber-200 text-center max-w-md animate-pulse">
              {scanStep === 1 && 'اضبط أبعاد صندوق الإحاطة 3D ليتطابق مع المجسم الحقيقي على طاولتك.'}
              {scanStep === 2 && 'تحرك ببطء حول المجسم من جميع الجهات لجمع سحابة النقاط المكانية.'}
              {scanStep === 3 && 'اضبط نقطة الأصل (RGB Origin Axes) لتحديد سطح ارتكاز المجسم في الغرفة.'}
              {scanStep === 4 && 'أدخل بيانات الميتاداتا لإنشاء كود RDF/Turtle وتصدير حزمة .arobject.'}
            </div>
          </div>
        )}

        {/* ── ARKit 3D Dimension Tags floating on the canvas ── */}
        <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2 text-[10px] font-mono text-cyan-300 vision-glass px-3 py-1.5 rounded-full border border-cyan-400/30">
          <span>W: {boxDimensions.widthCm} cm</span>
          <span>•</span>
          <span>H: {boxDimensions.heightCm} cm</span>
          <span>•</span>
          <span>D: {boxDimensions.depthCm} cm</span>
          <span>•</span>
          <span>Points: {featurePointsCount}</span>
        </div>
      </div>

      {/* ── BOTTOM DOCK CONTROLS ── */}
      <div className="z-20 pt-1">
        {/* Detect Mode: Quick Switcher for Detectable Artifacts */}
        {activeMode === 'detect' && (
          <div className="flex items-center justify-between gap-3 overflow-x-auto py-1 custom-scrollbar">
            <span className="text-xs font-bold text-white/80 whitespace-nowrap pl-1">
              القطع المتعرفة (Detected Reference Targets):
            </span>
            <div className="flex items-center gap-2">
              {referenceObjects.slice(0, 6).map((refObj, idx) => (
                <button
                  key={refObj.id}
                  onClick={() => {
                    spatialSound.playPinchTap?.();
                    setSelectedTargetIndex(idx);
                    setIsLockedOnObject(true);
                    setConfidence(0.95 + Math.random() * 0.04);
                  }}
                  className={`px-3 py-1.5 rounded-2xl flex items-center gap-2 text-xs transition cursor-pointer whitespace-nowrap ${
                    selectedTargetIndex === idx
                      ? 'bg-emerald-400 text-black font-bold shadow-[0_0_15px_rgba(52,211,153,0.4)]'
                      : 'vision-glass border border-white/15 text-white hover:bg-white/15'
                  }`}
                >
                  <img
                    src={refObj.image}
                    alt={refObj.name}
                    className="w-5 h-5 rounded-md object-cover bg-black/40"
                  />
                  <span>{refObj.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scan Mode Step 1: Bounding Box Size Adjusters */}
        {activeMode === 'scan' && scanStep === 1 && (
          <div className="p-3 rounded-2xl vision-glass border border-white/20 bg-black/60 space-y-2">
            <div className="grid grid-cols-3 gap-3 text-xs text-white">
              <div>
                <label className="text-[10px] text-white/60 block">العرض (Width X cm): {boxDimensions.widthCm}</label>
                <input
                  type="range"
                  min="8"
                  max="80"
                  value={boxDimensions.widthCm}
                  onChange={(e) => setBoxDimensions((p) => ({ ...p, widthCm: Number(e.target.value) }))}
                  className="w-full accent-amber-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/60 block">الارتفاع (Height Y cm): {boxDimensions.heightCm}</label>
                <input
                  type="range"
                  min="8"
                  max="120"
                  value={boxDimensions.heightCm}
                  onChange={(e) => setBoxDimensions((p) => ({ ...p, heightCm: Number(e.target.value) }))}
                  className="w-full accent-amber-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/60 block">العمق (Depth Z cm): {boxDimensions.depthCm}</label>
                <input
                  type="range"
                  min="8"
                  max="80"
                  value={boxDimensions.depthCm}
                  onChange={(e) => setBoxDimensions((p) => ({ ...p, depthCm: Number(e.target.value) }))}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  spatialSound.playPinchTap?.();
                  setScanStep(2);
                  setIsScanningActive(true);
                }}
                className="px-5 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <span>ابدأ المسح المحيطي 360° (Start Scan)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Scan Mode Step 2: 360° Coverage Progress */}
        {activeMode === 'scan' && scanStep === 2 && (
          <div className="p-3 rounded-2xl vision-glass border border-white/20 bg-black/60 flex items-center justify-between gap-4">
            <div className="grid grid-cols-5 gap-2 flex-1 text-center text-[10px]">
              <div className="bg-white/10 p-2 rounded-xl">
                <span className="block text-white/60">الأمام</span>
                <span className="font-bold text-amber-400">{scanCoverage.front}%</span>
              </div>
              <div className="bg-white/10 p-2 rounded-xl">
                <span className="block text-white/60">اليمين</span>
                <span className="font-bold text-amber-400">{scanCoverage.right}%</span>
              </div>
              <div className="bg-white/10 p-2 rounded-xl">
                <span className="block text-white/60">الخلف</span>
                <span className="font-bold text-amber-400">{scanCoverage.back}%</span>
              </div>
              <div className="bg-white/10 p-2 rounded-xl">
                <span className="block text-white/60">اليسار</span>
                <span className="font-bold text-amber-400">{scanCoverage.left}%</span>
              </div>
              <div className="bg-white/10 p-2 rounded-xl">
                <span className="block text-white/60">الأعلى</span>
                <span className="font-bold text-amber-400">{scanCoverage.top}%</span>
              </div>
            </div>

            <button
              onClick={() => {
                spatialSound.playPinchTap?.();
                setIsScanningActive(false);
                setScanStep(3);
              }}
              className="px-4 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs shadow-md"
            >
              اكتمال المسح
            </button>
          </div>
        )}

        {/* Scan Mode Step 3: Adjust Origin */}
        {activeMode === 'scan' && scanStep === 3 && (
          <div className="p-3 rounded-2xl vision-glass border border-white/20 bg-black/60 flex items-center justify-between gap-4">
            <div className="text-xs text-white/80 space-y-1">
              <span className="font-bold text-amber-300 block">محاور نقطة الأصل (ARKit Anchor Origin):</span>
              <span className="text-[11px] text-white/60">
                الأحمر: محور X • الأخضر: محور Y • الأزرق: محور Z
              </span>
            </div>

            <button
              onClick={() => {
                spatialSound.playPinchTap?.();
                setScanStep(4);
              }}
              className="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs shadow-md flex items-center gap-1.5"
            >
              <span>توثيق بيانات الميتاداتا (Enter RDF Metadata)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scan Mode Step 4: Metadata Form */}
        {activeMode === 'scan' && scanStep === 4 && (
          <div
            dir="rtl"
            className="p-4 rounded-2xl vision-glass border border-white/25 bg-[#0e1628]/95 space-y-3 max-h-[38vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-xs font-bold text-amber-300">توثيق ميتاداتا المجسم (RDF / Turtle Metadata)</h4>
              <span className="text-[10px] text-white/50">Apple ARKit ARObject Reference</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] text-white/60 block mb-1">اسم المجسم (Title AR):</label>
                <input
                  type="text"
                  value={customForm.titleAr}
                  onChange={(e) => setCustomForm((p) => ({ ...p, titleAr: e.target.value }))}
                  placeholder="مثال: خوذة قتالية مذهبة"
                  className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/60 block mb-1">الاسم بالإنجليزية (Title EN):</label>
                <input
                  type="text"
                  value={customForm.titleEn}
                  onChange={(e) => setCustomForm((p) => ({ ...p, titleEn: e.target.value }))}
                  placeholder="e.g. Ancient Islamic Gilded Helmet"
                  className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 text-white text-xs focus:border-amber-400 focus:outline-none text-left"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/60 block mb-1">الصانع / المصدر:</label>
                <input
                  type="text"
                  value={customForm.creatorAr}
                  onChange={(e) => setCustomForm((p) => ({ ...p, creatorAr: e.target.value }))}
                  placeholder="صانع غير معروف (العصر العثماني/الصفوي)"
                  className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/60 block mb-1">المادة والمواصفات:</label>
                <input
                  type="text"
                  value={customForm.materialsAr}
                  onChange={(e) => setCustomForm((p) => ({ ...p, materialsAr: e.target.value }))}
                  placeholder="صلب مطروق، ذهب، فضة"
                  className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="col-span-full">
                <label className="text-[10px] text-white/60 block mb-1">النص التراثي أو الوصف (Transcription):</label>
                <textarea
                  rows={2}
                  value={customForm.transcriptionAr}
                  onChange={(e) => setCustomForm((p) => ({ ...p, transcriptionAr: e.target.value }))}
                  placeholder="اكتب هنا النص التاريخي أو الوصف للقطعة..."
                  className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={handleSaveScannedObject}
                className="px-5 py-2 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <Download className="w-4 h-4" />
                <span>حفظ وتصدير ملف .arobject و RDF (Save & Export)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Saved Toast */}
      {savedSuccessToast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-6 py-4 rounded-2xl vision-glass border border-emerald-400 bg-black/90 text-emerald-300 font-bold text-sm shadow-2xl flex items-center gap-2 animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5" />
          <span>تم حفظ المجسم وتصدير حزمة .arobject بنجاح!</span>
        </div>
      )}
    </div>
  );
};
