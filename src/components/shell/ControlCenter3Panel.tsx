import React, { useState } from 'react';
import {
  Wifi,
  Bluetooth,
  Radio,
  Plane,
  Monitor,
  Copy,
  UserCheck,
  Share2,
  Moon,
  Volume2,
  Rewind,
  Pause,
  Play,
  FastForward,
  Airplay,
  ChevronRight,
  X,
  Compass,
  Sparkles,
  Crosshair,
} from 'lucide-react';
import { AppId, EnvironmentId } from '../../types/spatial';
import { spatialSound } from '../../utils/spatialSound';
import { assetUrl } from '../../utils/assetUrl';

interface ControlCenter3PanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentEnv: EnvironmentId;
  onSelectEnv: (env: EnvironmentId) => void;
  immersionLevel: number;
  onChangeImmersion: (val: number) => void;
  onOpenApp: (id: AppId) => void;
  onToggleRealCamera: () => void;
  realCameraActive: boolean;
  spatialWorldActive?: boolean;
  onToggleSpatialWorld?: () => void;
  alqamiModeActive?: boolean;
  onToggleAlqamiMode?: () => void;
  objectTracking3DActive?: boolean;
  onToggle3DObjectTracking?: () => void;
}

export const ControlCenter3Panel: React.FC<ControlCenter3PanelProps> = ({
  isOpen,
  onClose,
  currentEnv,
  onSelectEnv,
  immersionLevel,
  onChangeImmersion,
  onOpenApp,
  onToggleRealCamera,
  realCameraActive,
  spatialWorldActive = false,
  onToggleSpatialWorld,
  alqamiModeActive = false,
  onToggleAlqamiMode,
  objectTracking3DActive = false,
  onToggle3DObjectTracking,
}) => {
  const [wifiOn, setWifiOn] = useState(true);
  const [btOn, setBtOn] = useState(true);
  const [airdropOn, setAirdropOn] = useState(true);
  const [airplaneOn, setAirplaneOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(64);
  const [activeSystemRow, setActiveSystemRow] = useState<string | null>(null);

  if (!isOpen) return null;
  const now = new Date();

  const envLabels: Record<EnvironmentId, { name: string; subtitle: string; bg: string }> = {
    thorsmork: {
      name: 'Thórsmörk',
      subtitle: 'Icelandic Aurora',
      bg: 'linear-gradient(180deg, #27539b 0%, #3b6db3 45%, #1c3561 100%)',
    },
    'sunset-clouds': {
      name: 'Haleakalā',
      subtitle: 'Sunset Cloudscape',
      bg: 'linear-gradient(180deg, #375a7f 0%, #c87a5b 55%, #3d2c2e 100%)',
    },
    'living-room': {
      name: 'Living Room',
      subtitle: 'Architectural Warmth',
      bg: 'linear-gradient(180deg, #5e5246 0%, #3d342c 100%)',
    },
    'wood-studio': {
      name: 'Oak Studio',
      subtitle: 'Acoustic Wood Slat',
      bg: 'linear-gradient(180deg, #7c5836 0%, #46311d 100%)',
    },
    'cafe-lounge': {
      name: 'Belfort Lounge',
      subtitle: 'Evening Cinema',
      bg: 'linear-gradient(180deg, #3f2e21 0%, #1d1610 100%)',
    },
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/25 backdrop-blur-sm animate-fadeIn">
      {/* 3-Column Bento Layout (Exact Replica of control_center__e3iguusguvma_large.jpg) */}
      <div
        style={{ transform: 'translateZ(60px)' }}
        className="control-center-panel-track flex items-stretch gap-4 preserve-3d"
      >
        {/* LEFT PANEL: Date, 9:41 Clock, Battery, Kehlani Music Player & 3 Notifications */}
        <div className="w-[248px] h-[368px] rounded-[36px] vision-glass p-5 flex flex-col justify-between">
          {/* Top Clock Lockup */}
          <div className="text-center pt-1">
            <div className="text-[13px] font-medium text-white/85 tracking-wide">
              {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="text-[64px] leading-[1.02] font-light tracking-tight text-white my-0.5">
              {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-md bg-white/25 text-[11px] font-semibold text-white">
                100
              </span>
              <Wifi className="w-3.5 h-3.5 text-white/90" />
            </div>
          </div>

          {/* Middle Card: Alqami iPhone AR World Controller (Image 6) */}
          <div
            onClick={() => {
              spatialSound.playAlqamiChime();
              onToggleSpatialWorld?.();
            }}
            className={`rounded-[24px] transition-all duration-300 p-3.5 flex flex-col justify-between gap-3 cursor-pointer active:scale-98 select-none ${
              spatialWorldActive
                ? 'bg-amber-500/15 border-2 border-amber-400/90 shadow-[0_0_24px_rgba(245,158,11,0.35)]'
                : 'bg-black/35 hover:bg-black/50 border border-white/15'
            }`}
          >
            {/* Top row: Alqami Logo from alqami3 + Title + Subtitle */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shrink-0 flex items-center justify-center shadow-lg shadow-amber-500/25 p-1.5 overflow-hidden">
                <img
                  src={assetUrl('logo.png')}
                  alt="Alqami Logo"
                  className="w-full h-full object-contain drop-shadow"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-white tracking-wide truncate">
                  ALQAMI · علقمي
                </div>
                <div className="text-[12px] text-amber-300 font-medium flex items-center gap-1">
                  <span>🌐 iPhone AR World</span>
                </div>
              </div>
            </div>

            {/* Bottom row: Active in Room / Vision Pro Mode status pill */}
            <div className="pt-0.5">
              <div
                className={`w-full py-1.5 px-3 rounded-full text-xs font-semibold flex items-center justify-between transition-all ${
                  spatialWorldActive
                    ? 'bg-amber-400/30 text-amber-100 border border-amber-300/50 shadow-inner'
                    : 'bg-white/10 text-white/75 hover:bg-white/15'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      spatialWorldActive
                        ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]'
                        : 'bg-white/40'
                    }`}
                  />
                  <span>{spatialWorldActive ? 'Active in Room' : 'Activate AR World'}</span>
                </div>
                <span className="text-[10.5px] opacity-75 font-normal">Vision Pro Mode</span>
              </div>
            </div>
          </div>

          {/* Bottom 3 Notifications Pill */}
          <button
            onClick={() => {
              spatialSound.playPinchTap();
              onOpenApp('messages');
              onClose();
            }}
            className="vision-btn w-full h-11 rounded-full bg-black/25 border border-white/10 px-3.5 flex items-center justify-between"
          >
            <div className="flex items-center -space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500 border border-black/30 flex items-center justify-center text-[10px] font-bold">
                💬
              </span>
              <span className="w-5 h-5 rounded-full bg-sky-500 border border-black/30 flex items-center justify-center text-[10px] font-bold">
                ✉️
              </span>
              <span className="w-5 h-5 rounded-full bg-amber-500 border border-black/30 flex items-center justify-center text-[10px] font-bold">
                🗒️
              </span>
            </div>
            <span className="text-[12px] font-medium text-white/90">
              3 Notifications
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-white/55" />
          </button>
        </div>

        {/* CENTER PANEL: 4 Connectivity Circles, System Action List & Volume Pill */}
        <div className="w-[248px] h-[368px] rounded-[36px] vision-glass p-4 flex flex-col justify-between">
          {/* Top 4 Circular Toggles */}
          <div className="grid grid-cols-4 gap-2.5">
            <button
              onClick={() => {
                setWifiOn(!wifiOn);
                spatialSound.playPinchTap();
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                wifiOn
                  ? 'bg-[#0A84FF] text-white shadow-[0_0_16px_rgba(10,132,255,0.6)]'
                  : 'bg-white/15 text-white/70'
              }`}
            >
              <Wifi className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setBtOn(!btOn);
                spatialSound.playPinchTap();
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                btOn
                  ? 'bg-[#0A84FF] text-white shadow-[0_0_16px_rgba(10,132,255,0.6)]'
                  : 'bg-white/15 text-white/70'
              }`}
            >
              <Bluetooth className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setAirdropOn(!airdropOn);
                spatialSound.playPinchTap();
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                airdropOn
                  ? 'bg-[#0A84FF] text-white shadow-[0_0_16px_rgba(10,132,255,0.6)]'
                  : 'bg-white/15 text-white/70'
              }`}
            >
              <Radio className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setAirplaneOn(!airplaneOn);
                spatialSound.playPinchTap();
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                airplaneOn
                  ? 'bg-amber-500 text-white'
                  : 'bg-black/30 text-white/85 border border-white/10'
              }`}
            >
              <Plane className="w-5 h-5" />
            </button>
          </div>

          {/* Middle Action List */}
          <div className="rounded-[24px] bg-black/25 border border-white/10 py-1.5 px-2 flex flex-col gap-0.5 my-2 flex-1 justify-center">
            {[
              {
                id: 'alqami',
                label: alqamiModeActive ? '✨ Alqami AR (Active)' : '✨ Alqami AR Mode',
                icon: Sparkles,
                action: () => {
                  spatialSound.playAlqamiChime();
                  onToggleAlqamiMode?.();
                },
              },
              {
                id: 'object3d',
                label: objectTracking3DActive || alqamiModeActive ? '📦 3D Tracking (Active)' : '📦 3D Object Tracking',
                icon: Crosshair,
                action: () => {
                  spatialSound.playPinchTap();
                  onToggle3DObjectTracking?.();
                },
              },
              {
                id: 'mac',
                label: 'Mac Virtual Display',
                icon: Monitor,
                action: () => {
                  onOpenApp('mac-display');
                  onClose();
                },
              },
              {
                id: 'mirror',
                label: realCameraActive ? 'Real Camera AR (Active)' : 'Mirror / Phone Cam AR',
                icon: Copy,
                action: () => onToggleRealCamera(),
              },
              {
                id: 'guest',
                label: 'Guest User',
                icon: UserCheck,
                action: () => setActiveSystemRow('guest'),
              },
              {
                id: 'share',
                label: 'Window Sharing',
                icon: Share2,
                action: () => setActiveSystemRow('share'),
              },
              {
                id: 'focus',
                label: 'Focus',
                icon: Moon,
                action: () => setActiveSystemRow('focus'),
              },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activeSystemRow === item.id || (item.id === 'mirror' && realCameraActive);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    spatialSound.playPinchTap();
                    item.action();
                  }}
                  className={`w-full px-3 py-2 rounded-xl flex items-center gap-3 text-left text-[13px] font-medium transition ${
                    isSelected
                      ? 'bg-white/25 text-white'
                      : 'text-white/90 hover:bg-white/15'
                  }`}
                >
                  <Icon className="w-4 h-4 text-white/80 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom Thick Pill Volume Slider */}
          <div className="relative w-full h-11 rounded-full bg-black/35 border border-white/10 overflow-hidden flex items-center">
            <div
              style={{ width: `${volume}%` }}
              className="h-full bg-white rounded-full transition-all duration-75"
            />
            <Volume2
              className={`w-4 h-4 absolute left-3.5 pointer-events-none ${
                volume > 18 ? 'text-black/80' : 'text-white/80'
              }`}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* RIGHT PANEL: Thórsmörk Environment Preview Card + Immersion Slider */}
        <div
          style={{
            background: envLabels[currentEnv].bg,
          }}
          className="w-[248px] h-[368px] rounded-[36px] vision-glass p-4 flex flex-col justify-between relative overflow-hidden"
        >
          {/* Mountain & Aurora Scenic Backdrop Overlay */}
          <img
            src="/reference/control_center__e3iguusguvma_large.jpg"
            alt="Thórsmörk"
            className="absolute inset-0 w-full h-full object-cover object-[78%_50%] scale-[1.85] opacity-85 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sky-900/30 via-transparent to-slate-950/75 pointer-events-none" />

          {/* Top 2 Circular Icons */}
          <div className="relative z-10 flex items-center justify-between">
            <button
              onClick={() => {
                const order: EnvironmentId[] = [
                  'thorsmork',
                  'sunset-clouds',
                  'living-room',
                  'wood-studio',
                  'cafe-lounge',
                ];
                const next = order[(order.indexOf(currentEnv) + 1) % order.length];
                onSelectEnv(next);
                spatialSound.playPinchTap();
              }}
              className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/35 transition"
              title="Cycle Spatial Environment"
            >
              <Compass className="w-4 h-4" />
            </button>
            <button
              onClick={() => spatialSound.playSiriChime()}
              className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/35 transition"
              title="Environment Ambient Sound"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {/* Center Environment Title */}
          <div className="relative z-10 text-center my-auto">
            <div className="text-[28px] font-bold text-white tracking-tight drop-shadow-md">
              {envLabels[currentEnv].name}
            </div>
            <div className="text-[11px] text-white/80 font-medium mt-0.5">
              {envLabels[currentEnv].subtitle} • Click to switch
            </div>
          </div>

          {/* Bottom Immersion Crown Slider */}
          <div className="relative z-10 w-full h-11 rounded-full bg-slate-950/55 backdrop-blur-md border border-white/20 p-1 flex items-center">
            <div
              style={{ width: `${Math.max(18, immersionLevel)}%` }}
              className="h-full bg-white/30 rounded-full flex items-center justify-end pr-1 transition-all duration-75"
            >
              <div className="w-8 h-8 rounded-full bg-white shadow-md" />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={immersionLevel}
              onChange={(e) => onChangeImmersion(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Adjust Environment Immersion Depth (Digital Crown)"
            />
          </div>
        </div>
      </div>

      {/* Bottom Circular X Close Button (Exact Match to control_center__e3iguusguvma_large.jpg) */}
      <button
        onClick={() => {
          spatialSound.playPinchTap();
          onClose();
        }}
        className="vision-btn mt-5 w-10 h-10 rounded-full vision-ornament flex items-center justify-center text-white/90 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
