import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Share,
  Heart,
  Plus,
  Minus,
  Box,
  Rotate3d,
  X,
  ShoppingBag,
  ArrowRight,
  Star,
  Check,
  Scan,
  Sparkles,
} from 'lucide-react';
import { ALQAMI_ARTIFACTS, AlqamiArtifact } from '../../data/alqamiArtifacts';
import { AlqamiArtifact3DCanvas } from '../three/AlqamiArtifact3DCanvas';
import { AlqamiARKitObjectScanner } from './AlqamiARKitObjectScanner';
import { spatialSound } from '../../utils/spatialSound';

interface AlqamiSpatialAppProps {
  onPreviewInSpace?: (artifact?: AlqamiArtifact) => void;
}

export const AlqamiSpatialApp: React.FC<AlqamiSpatialAppProps> = ({ onPreviewInSpace }) => {
  // Start directly on 'catalog' (Image 1) when entering the app
  const [view, setView] = useState<'catalog' | 'detail' | 'room-bento'>('catalog');
  const [isLeavingView, setIsLeavingView] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeArtifactIndex, setActiveArtifactIndex] = useState(0);
  const [isPopOut3D, setIsPopOut3D] = useState(false);
  const [isClosingPopOut, setIsClosingPopOut] = useState(false);
  const [isDissolvingForAR, setIsDissolvingForAR] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [cartCount, setCartCount] = useState(0);
  const [openAccordion, setOpenAccordion] = useState<string | null>('details');
  const [addedToast, setAddedToast] = useState(false);
  const [deployedToast, setDeployedToast] = useState<string | null>(null);

  const viewTransitionTimerRef = useRef<number | null>(null);
  const popOutTimerRef = useRef<number | null>(null);
  const arDissolveTimerRef = useRef<number | null>(null);

  const currentArtifact = ALQAMI_ARTIFACTS[activeArtifactIndex] || ALQAMI_ARTIFACTS[0];

  useEffect(() => () => {
    if (viewTransitionTimerRef.current !== null) window.clearTimeout(viewTransitionTimerRef.current);
    if (popOutTimerRef.current !== null) window.clearTimeout(popOutTimerRef.current);
    if (arDissolveTimerRef.current !== null) window.clearTimeout(arDissolveTimerRef.current);
  }, []);

  const transitionToView = (nextView: typeof view) => {
    if (nextView === view || isLeavingView) return;
    setIsLeavingView(true);
    viewTransitionTimerRef.current = window.setTimeout(() => {
      setView(nextView);
      setIsLeavingView(false);
      viewTransitionTimerRef.current = null;
    }, 150);
  };

  const openPopOut3D = () => {
    if (popOutTimerRef.current !== null) window.clearTimeout(popOutTimerRef.current);
    popOutTimerRef.current = null;
    setIsClosingPopOut(false);
    setIsPopOut3D(true);
    spatialSound.playPinchTap();
  };

  const closePopOut3D = () => {
    if (!isPopOut3D || isClosingPopOut) return;
    setIsClosingPopOut(true);
    spatialSound.playPinchTap();
    popOutTimerRef.current = window.setTimeout(() => {
      setIsPopOut3D(false);
      setIsClosingPopOut(false);
      popOutTimerRef.current = null;
    }, 360);
  };

  // Preview in room space (placed in another distinct location than the tab)
  const triggerARPreviewInSpace = (art: AlqamiArtifact = currentArtifact) => {
    spatialSound.playPinchTap();
    setIsDissolvingForAR(true);

    window.dispatchEvent(
      new CustomEvent('visionos:place-ar-object', {
        detail: {
          glb: art.model.glb,
          label: `${art.title.ar} · ${art.title.en}`,
          scale: art.model.scale || 1.0,
          dimensions: art.details.dimensions,
          id: art.id,
          offsetPlacement: true,
        },
      })
    );

    onPreviewInSpace?.(art);

    setDeployedToast(`✨ تم نشر ${art.title.ar} ثلاثي الأبعاد في غرفتك بجانب النافذة!`);
    setTimeout(() => setDeployedToast(null), 3600);

    if (arDissolveTimerRef.current !== null) window.clearTimeout(arDissolveTimerRef.current);
    arDissolveTimerRef.current = window.setTimeout(() => {
      setIsDissolvingForAR(false);
      arDissolveTimerRef.current = null;
    }, 600);
  };

  const handleNextArtifact = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    spatialSound.playPinchTap();
    setActiveArtifactIndex((prev) => (prev + 1) % ALQAMI_ARTIFACTS.length);
  };

  const handlePrevArtifact = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    spatialSound.playPinchTap();
    setActiveArtifactIndex((prev) => (prev - 1 + ALQAMI_ARTIFACTS.length) % ALQAMI_ARTIFACTS.length);
  };

  const categories = [
    'All',
    'Artifact',
    'Manuscripts',
    'Islamic Art',
    'History',
    'Heritage',
    'Museum',
    'Culture',
  ];

  const filteredArtifacts =
    activeCategory === 'All'
      ? ALQAMI_ARTIFACTS
      : ALQAMI_ARTIFACTS.filter(
          (a) =>
            a.category.toLowerCase().includes(activeCategory.toLowerCase().replace(' ', '-')) ||
            (activeCategory === 'Heritage' && (a.category === 'manuscripts' || a.category === 'artifact')) ||
            (activeCategory === 'Museum' && a.institution) ||
            (activeCategory === 'Culture' && a.period)
        );

  const toggleLike = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    spatialSound.playPinchTap();
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddToCart = () => {
    spatialSound.playPinchTap();
    setCartCount((c) => c + quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2400);
  };

  const toggleAccordion = (id: string) => {
    spatialSound.playPinchTap();
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full h-full relative preserve-3d select-none pointer-events-auto">
      {/* Dissolve Transition for AR placement */}
      {isDissolvingForAR && (
        <div aria-hidden="true" className="absolute inset-0 z-50 rounded-[38px] ikea-ar-dissolve pointer-events-none" />
      )}

      {/* Cart Toast Notification */}
      {addedToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full vision-glass border border-emerald-400/50 text-emerald-300 text-xs shadow-[0_8px_24px_rgba(52,211,153,0.4)] pointer-events-none">
          <Check className="h-4 w-4" />
          <span>تمت إضافة المقتنى إلى السلة ({quantity} قطعة)</span>
        </div>
      )}

      {/* Deployed In Space Toast Notification */}
      {deployedToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full vision-glass border border-amber-400/60 bg-black/75 text-amber-300 text-xs font-semibold shadow-[0_8px_28px_rgba(245,190,70,0.5)] pointer-events-none animate-in fade-in slide-in-from-top-2">
          <Sparkles className="h-4 w-4" />
          <span>{deployedToast}</span>
        </div>
      )}

      {/* Apple ARKit 3D Object Scanner & RDF Recall Studio */}
      <AlqamiARKitObjectScanner
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onDeployInSpace={(art) => triggerARPreviewInSpace(art)}
        onOpenDetail={(art) => {
          const idx = ALQAMI_ARTIFACTS.findIndex((a) => a.id === art.id);
          if (idx >= 0) setActiveArtifactIndex(idx);
          transitionToView('detail');
        }}
      />

      {/* 3D Volume Pop-Out Overlay in Front of Dimmed Window */}
      {isPopOut3D && (
        <div
          style={{ transform: 'translate3d(0, 0, 160px)' }}
          className={`absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-auto preserve-3d ${
            isClosingPopOut ? 'ikea-volume-exit' : 'ikea-volume-enter'
          }`}
        >
          <div
            style={{
              width: 'min(520px, calc(100vw - 56px))',
              maxHeight: 'min(390px, calc(100dvh - 180px))',
              aspectRatio: '4 / 3',
            }}
            className={`drop-shadow-[0_45px_75px_rgba(0,0,0,0.85)] ${
              isClosingPopOut ? 'ikea-volume-model-exit' : 'ikea-volume-model-enter'
            }`}
          >
            <AlqamiArtifact3DCanvas glbUrl={currentArtifact.model.glb} mode="popout" autoRotate={true} />
          </div>
          <button
            onClick={closePopOut3D}
            disabled={isClosingPopOut}
            className="vision-btn mt-2 px-5 py-2 rounded-full vision-ornament flex items-center gap-2 text-[13px] font-semibold text-white shadow-xl cursor-pointer"
          >
            <span>Close preview</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 1: GET INSPIRED CATALOG (DEFAULT FIRST VIEW - IMAGE 1)
         ───────────────────────────────────────────────────────────── */}
      {view === 'catalog' && (
        <div
          className={`w-full h-full overflow-y-auto p-6 space-y-6 text-white custom-scrollbar pointer-events-auto ${
            isLeavingView ? 'ikea-scene-leave' : 'ikea-scene-enter'
          }`}
        >
          {/* Blue Architectural Hero Banner with DYNAMIC 3D MOVING ARTIFACT */}
          <div className="w-full min-h-[220px] rounded-[28px] bg-gradient-to-r from-[#124091] via-[#1c56b8] to-[#0f3478] p-7 flex items-center justify-between relative overflow-hidden shadow-lg border border-white/15 ikea-hero-arrive">
            <div className="z-10 max-w-sm space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">
                Discover authentic artifacts
              </span>
              <h2 className="text-[26px] font-bold leading-tight text-white">
                Explore the treasures of Islamic heritage
              </h2>
              <p className="text-[13px] text-white/80">
                Unique artifacts, rich stories, timeless culture
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    spatialSound.playPinchTap();
                    setActiveArtifactIndex(0);
                    transitionToView('detail');
                  }}
                  className="h-9 px-5 rounded-full bg-[#FFD60A] hover:bg-[#ffe03b] text-black font-semibold text-[13px] flex items-center gap-2 hover:scale-105 active:scale-95 transition cursor-pointer shadow-md"
                >
                  <span>Discover</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right: 3D MOVING ARTIFACT IN THE BLUE BANNER */}
            <div className="flex items-center gap-3 pr-4 z-10 h-full">
              <div className="w-48 h-48 relative drop-shadow-[0_25px_35px_rgba(0,0,0,0.65)] pointer-events-auto flex items-center justify-center">
                <AlqamiArtifact3DCanvas
                  glbUrl="/models/Old_Islamic_Helmet.glb"
                  mode="banner"
                  autoRotate={true}
                  className="w-full h-full relative z-10"
                />
              </div>

              {/* Glowing Armchair & Orb Stage */}
              <div className="w-16 h-24 rounded-2xl bg-[#2764c9]/80 border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg">
                <span className="w-5 h-5 rounded-full bg-amber-300 shadow-[0_0_18px_#fde047] animate-pulse" />
              </div>
            </div>
          </div>

          {/* Get Inspired Category Pills & Camera Scanner Action */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[20px] font-bold">Get inspired</h3>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    spatialSound.playPinchTap();
                    setIsScanModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-xs font-semibold text-emerald-300 transition cursor-pointer shadow-sm active:scale-95"
                  title="Apple ARKit 3D Object Scanner & RDF Recall"
                >
                  <Scan className="w-3.5 h-3.5 animate-pulse text-emerald-300" />
                  <span>مسح وتتبع 3D واسترجاع RDF (ARKit Scanner)</span>
                </button>
                <button
                  onClick={() => {
                    spatialSound.playPinchTap();
                    transitionToView('room-bento');
                  }}
                  className="text-xs text-amber-300 hover:underline font-medium cursor-pointer"
                >
                  Open Room Hotspot Gallery →
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    spatialSound.playPinchTap();
                  }}
                  className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium transition cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-white text-black font-semibold shadow'
                      : 'bg-white/15 text-white/85 hover:bg-white/25'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* All 11 Authentic Artifacts Grid from alqami4 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {filteredArtifacts.map((prod, productIndex) => {
              const globalIdx = ALQAMI_ARTIFACTS.findIndex((a) => a.id === prod.id);
              const isFav = !!liked[prod.id];

              return (
                <div
                  key={prod.id}
                  onClick={() => {
                    spatialSound.playPinchTap();
                    setActiveArtifactIndex(globalIdx >= 0 ? globalIdx : 0);
                    transitionToView('detail');
                  }}
                  style={{ animationDelay: `${Math.min(240, productIndex * 45)}ms` }}
                  className="group cursor-pointer rounded-[24px] bg-white/10 hover:bg-white/15 border border-white/10 p-3.5 flex flex-col justify-between transition-all hover:scale-[1.02] ikea-product-card-enter pointer-events-auto shadow-sm"
                >
                  {/* Real 3D Model Stage (NOT static images!) */}
                  <div className="h-36 rounded-[18px] bg-gradient-to-b from-[#2a2d3d] to-[#151722] flex items-center justify-center relative overflow-hidden">
                    <AlqamiArtifact3DCanvas
                      glbUrl={prod.model.glb}
                      mode="card"
                      autoRotate={false}
                      className="w-full h-full relative z-10"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-mono text-emerald-300 flex items-center gap-1 z-20 pointer-events-none">
                      <Box className="w-2.5 h-2.5" /> 3D Model
                    </span>
                  </div>

                  {/* Info */}
                  <div className="mt-3 space-y-1">
                    <h4 className="text-[14.5px] font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {prod.title.ar}
                    </h4>
                    <p className="text-[11.5px] text-white/70 line-clamp-1">
                      {prod.title.en}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11.5px] font-bold font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
                        {prod.itemCode}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => toggleLike(prod.id, e)}
                          className={`p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer ${
                            isFav ? 'text-rose-400' : 'text-white/60'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-400' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerARPreviewInSpace(prod);
                          }}
                          className="p-1.5 rounded-full hover:bg-white/20 text-cyan-300 transition cursor-pointer"
                          title="Place in room"
                        >
                          <Box className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 2: SPLIT-PANE PRODUCT DETAIL (IMAGE 2)
         ───────────────────────────────────────────────────────────── */}
      {view === 'detail' && (
        <div
          className={`w-full h-full grid grid-cols-12 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            isLeavingView ? 'ikea-scene-leave' : 'ikea-scene-enter'
          } ${isPopOut3D ? 'opacity-30 blur-md scale-[0.98]' : 'opacity-100'}`}
        >
          {/* Left Pane: Warm Stone-Gray 3D Studio Viewport (#CBC9C5) */}
          <div className="col-span-7 bg-[#CBC9C5] text-stone-900 relative flex flex-col justify-between p-6 overflow-hidden">
            {/* Interactive 3D Artifact */}
            <div className="flex-1 w-full relative flex items-center justify-center">
              <AlqamiArtifact3DCanvas glbUrl={currentArtifact.model.glb} mode="embedded" autoRotate={true} />

              {/* Curved Orbit Track + 3D Pop-Out Button Beneath Artifact */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                <div className="w-48 h-4 border-b border-stone-400/60 rounded-b-full" />
                <button
                  onClick={openPopOut3D}
                  className="vision-btn -mt-3.5 w-8 h-8 rounded-full bg-stone-600/60 hover:bg-stone-800 text-white flex items-center justify-center shadow cursor-pointer transition-transform active:scale-95"
                  title="Pop out 3D Volume in front of window"
                >
                  <Rotate3d className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom Controls: "Preview in your space" Pill + < > Gallery Arrows */}
            <div className="flex items-center justify-between pt-2 pointer-events-auto">
              <button
                onClick={() => triggerARPreviewInSpace(currentArtifact)}
                className="vision-btn h-10 px-4 rounded-full bg-stone-700/55 hover:bg-stone-800/80 text-white text-[13px] font-medium flex items-center gap-2 shadow-sm backdrop-blur-md cursor-pointer transition-all active:scale-95"
              >
                <Box className="w-4 h-4" />
                <span>Preview in your space</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevArtifact}
                  className="w-9 h-9 rounded-full bg-stone-700/45 hover:bg-stone-800/75 text-white flex items-center justify-center transition cursor-pointer active:scale-95"
                  title="Previous Artifact"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextArtifact}
                  className="w-9 h-9 rounded-full bg-stone-700/45 hover:bg-stone-800/75 text-white flex items-center justify-center transition cursor-pointer active:scale-95"
                  title="Next Artifact"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Pane: Translucent Spatial Frosted Glass Product Details */}
          <div className="col-span-5 p-7 flex flex-col justify-between text-white overflow-y-auto pointer-events-auto custom-scrollbar">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  spatialSound.playPinchTap();
                  transitionToView('catalog');
                }}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition cursor-pointer"
                title="Back to Catalog"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    spatialSound.playPinchTap();
                    if (navigator.share) {
                      navigator.share({
                        title: currentArtifact.title.ar,
                        text: currentArtifact.description.ar,
                        url: window.location.href,
                      });
                    }
                  }}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition cursor-pointer"
                  title="Share"
                >
                  <Share className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => toggleLike(currentArtifact.id, e)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
                    liked[currentArtifact.id] ? 'bg-rose-500 text-white' : 'bg-white/15 hover:bg-white/25'
                  }`}
                  title="Favorite"
                >
                  <Heart className={`w-4 h-4 ${liked[currentArtifact.id] ? 'fill-white' : ''}`} />
                </button>
              </div>
            </div>

            {/* Product Title & Reviews */}
            <div className="space-y-1.5 my-3">
              <div className="flex items-center justify-between">
                <h1 className="text-[28px] font-bold leading-tight tracking-tight">
                  {currentArtifact.title.ar}
                </h1>
                <div className="flex items-center gap-1 text-[13px] text-white/80 font-mono">
                  <span>{currentArtifact.reviewsCount} reviews</span>
                  <div className="flex text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.floor(currentArtifact.rating) ? 'fill-amber-400 text-amber-400' : 'text-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[13px] text-white/70">
                {currentArtifact.subtitle?.ar || currentArtifact.period.ar}
              </p>
            </div>

            {/* Description Paragraph */}
            <p className="text-[13px] leading-relaxed text-white/80 font-light mb-3">
              {currentArtifact.description.ar}
            </p>

            {/* Item Code Badge */}
            <div className="mb-3">
              <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-[11px] font-mono text-white/80 border border-white/10">
                رقم القطعة: {currentArtifact.itemCode}
              </span>
            </div>

            {/* Collapsible Accordions (Piece Details, Dimensions, Delivery, Assembly) */}
            <div className="border-t border-white/15 divide-y divide-white/15 my-2">
              {/* 1. تفاصيل القطعة */}
              <div className="py-2.5">
                <button
                  onClick={() => toggleAccordion('details')}
                  className="w-full flex items-center justify-between text-[13.5px] font-semibold text-white/90 hover:text-white cursor-pointer"
                >
                  <span>تفاصيل القطعة (Details)</span>
                  <Plus className={`w-4 h-4 transition-transform ${openAccordion === 'details' ? 'rotate-45' : ''}`} />
                </button>
                {openAccordion === 'details' && (
                  <div className="pt-2 text-[12px] text-white/70 space-y-1 font-light leading-relaxed">
                    <p><strong className="text-white/90">المادة:</strong> {currentArtifact.details.material.ar}</p>
                    <p><strong className="text-white/90">الحالة:</strong> {currentArtifact.details.condition.ar}</p>
                    {currentArtifact.details.binding && (
                      <p><strong className="text-white/90">التجليد:</strong> {currentArtifact.details.binding.ar}</p>
                    )}
                    {currentArtifact.details.decoration && (
                      <p><strong className="text-white/90">الزخرفة:</strong> {currentArtifact.details.decoration.ar}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. القياسات */}
              <div className="py-2.5">
                <button
                  onClick={() => toggleAccordion('dimensions')}
                  className="w-full flex items-center justify-between text-[13.5px] font-semibold text-white/90 hover:text-white cursor-pointer"
                >
                  <span>القياسات (Measurements)</span>
                  <Plus className={`w-4 h-4 transition-transform ${openAccordion === 'dimensions' ? 'rotate-45' : ''}`} />
                </button>
                {openAccordion === 'dimensions' && (
                  <div className="pt-2 text-[12px] text-white/70 font-light">
                    <p><strong className="text-white/90">الأبعاد:</strong> {currentArtifact.details.dimensions}</p>
                  </div>
                )}
              </div>

              {/* 3. التسليم و التعليمات */}
              <div className="py-2.5">
                <button
                  onClick={() => toggleAccordion('delivery')}
                  className="w-full flex items-center justify-between text-[13.5px] font-semibold text-white/90 hover:text-white cursor-pointer"
                >
                  <span>التسليم و التعليمات (Delivery & Packaging)</span>
                  <Plus className={`w-4 h-4 transition-transform ${openAccordion === 'delivery' ? 'rotate-45' : ''}`} />
                </button>
                {openAccordion === 'delivery' && (
                  <div className="pt-2 text-[12px] text-white/70 font-light leading-relaxed">
                    <p>{currentArtifact.details.delivery?.ar || 'شحن آمن في حافظة حرارية مضادة للصدمات.'}</p>
                  </div>
                )}
              </div>

              {/* 4. تعليمات التجميع */}
              <div className="py-2.5">
                <button
                  onClick={() => toggleAccordion('assembly')}
                  className="w-full flex items-center justify-between text-[13.5px] font-semibold text-white/90 hover:text-white cursor-pointer"
                >
                  <span>تعليمات التجميع (Assembly & Mounting)</span>
                  <Plus className={`w-4 h-4 transition-transform ${openAccordion === 'assembly' ? 'rotate-45' : ''}`} />
                </button>
                {openAccordion === 'assembly' && (
                  <div className="pt-2 text-[12px] text-white/70 font-light leading-relaxed">
                    <p>{currentArtifact.details.assembly?.ar || 'لا تتطلب تجميع؛ جاهزة للعرض أو المعاينة المباشرة.'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Museum Heritage 3D Room Exploration Action (Image 3 Stepper & Cart removed) */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => triggerARPreviewInSpace(currentArtifact)}
                className="vision-btn h-11 px-7 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-[13.5px] shadow-lg flex items-center gap-2.5 cursor-pointer active:scale-95 transition-all"
              >
                <Box className="w-4 h-4" />
                <span>معاينة ثلاثية الأبعاد في الغرفة (Preview 3D in Room)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 3: ROOM BENTO GALLERY (360° Hotspot Gallery)
         ───────────────────────────────────────────────────────────── */}
      {view === 'room-bento' && (
        <div className="w-full h-full overflow-y-auto p-6 space-y-5 text-white pointer-events-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                spatialSound.playPinchTap();
                transitionToView('catalog');
              }}
              className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white px-3 py-1.5 rounded-full bg-white/15 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Catalog</span>
            </button>
            <h2 className="text-lg font-bold">Room Hotspot Gallery</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {ALQAMI_ARTIFACTS.slice(0, 4).map((art, idx) => (
              <div
                key={art.id}
                onClick={() => {
                  spatialSound.playPinchTap();
                  setActiveArtifactIndex(idx);
                  transitionToView('detail');
                }}
                className="rounded-2xl bg-white/10 p-4 border border-white/15 hover:bg-white/20 transition cursor-pointer flex flex-col justify-between h-48"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-300">Hotspot #{idx + 1}</span>
                  <span className="text-xs font-bold text-amber-300">${art.price}</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm">{art.title.ar}</h3>
                  <p className="text-xs text-white/70">{art.title.en}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerARPreviewInSpace(art);
                  }}
                  className="w-full py-1.5 rounded-full bg-stone-700/60 hover:bg-stone-700 text-xs font-medium flex items-center justify-center gap-2"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>Deploy in your room</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
