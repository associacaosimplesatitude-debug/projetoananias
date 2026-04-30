import { useEffect, useRef, useState } from "react";
import { Play, Pause, Rewind, FastForward, ChevronDown, X as CloseIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLicaoAudioCtx } from "./LicaoAudioContext";

interface Props {
  audioUrl: string;
  licaoId: string;
  licaoTitulo: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const EXPANDED_KEY = "licao_audio_expanded";

function fmt(t: number) {
  if (!isFinite(t)) return "00:00";
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function LicaoAudioPlayer({ audioUrl, licaoId, licaoTitulo }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { activeLicaoId, registerActive, unregisterActive, setVisibleLicao } = useLicaoAudioCtx();

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(EXPANDED_KEY) === "1";
  });

  const storageKey = `licao_audio_pos_${licaoId}`;

  // Restaurar posição salva
  useEffect(() => {
    const saved = parseFloat(localStorage.getItem(storageKey) || "0");
    if (saved > 0 && audioRef.current) {
      audioRef.current.currentTime = saved;
      setCurrent(saved);
    }
  }, [storageKey]);

  // Salvar posição a cada 5s
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (audioRef.current) {
        localStorage.setItem(storageKey, String(audioRef.current.currentTime));
      }
    }, 5000);
    return () => clearInterval(id);
  }, [playing, storageKey]);

  // Persistir preferência expanded
  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, expanded ? "1" : "0");
  }, [expanded]);

  // No modo scroll contínuo (várias lições), informar visibilidade
  useEffect(() => {
    if (!containerRef.current) return;
    const block = containerRef.current.closest("[data-licao-id]") as HTMLElement | null;
    if (!block) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && e.intersectionRatio > 0.3) {
          setVisibleLicao(licaoId);
        }
      },
      { threshold: [0, 0.3, 0.5, 0.75, 1] },
    );
    obs.observe(block);
    return () => obs.disconnect();
  }, [licaoId, setVisibleLicao]);

  // Pausar este se outro player ficou ativo
  useEffect(() => {
    if (activeLicaoId && activeLicaoId !== licaoId && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [activeLicaoId, licaoId]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      registerActive(licaoId, audioRef.current);
      setPlaying(true);
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const skip = (sec: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + sec));
  };

  const onSeek = (vals: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = vals[0];
    setCurrent(vals[0]);
  };

  const onSpeed = (v: string) => {
    const n = parseFloat(v);
    setSpeed(n);
    if (audioRef.current) audioRef.current.playbackRate = n;
  };

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;

  // Geometria do anel de progresso (FAB)
  const FAB_SIZE = 56;
  const RING_RADIUS = 25;
  const RING_CIRC = 2 * Math.PI * RING_RADIUS;
  const dashOffset = RING_CIRC * (1 - progressPct / 100);

  return (
    <div
      ref={containerRef}
      data-licao-audio={licaoId}
      style={{
        position: "fixed",
        right: "max(8px, env(safe-area-inset-right))",
        top: "calc(48px + env(safe-area-inset-top))",
        zIndex: 40,
        pointerEvents: "auto",
      }}
      className="md:right-4 md:top-[56px]"
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => {
          setPlaying(true);
          if (audioRef.current) registerActive(licaoId, audioRef.current);
        }}
        onPause={() => {
          setPlaying(false);
          unregisterActive(licaoId);
          if (audioRef.current) localStorage.setItem(storageKey, String(audioRef.current.currentTime));
        }}
        onEnded={() => {
          setPlaying(false);
          unregisterActive(licaoId);
          localStorage.removeItem(storageKey);
        }}
      />

      {!expanded ? (
        // ============ FAB (colapsado) ============
        <div style={{ position: "relative", width: FAB_SIZE, height: FAB_SIZE }}>
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pausar áudio" : "Tocar áudio"}
            style={{
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: "50%",
              backgroundColor: "#1c1915",
              border: "1px solid rgba(246,186,50,0.35)",
              color: "#f6ba32",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              padding: 0,
              animation: playing ? "fabPulse 2s ease-in-out infinite" : undefined,
            }}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          {/* anel de progresso */}
          <svg
            width={FAB_SIZE}
            height={FAB_SIZE}
            style={{ position: "absolute", inset: 0, pointerEvents: "none", transform: "rotate(-90deg)" }}
          >
            <circle
              cx={FAB_SIZE / 2}
              cy={FAB_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(246,186,50,0.18)"
              strokeWidth={3}
            />
            <circle
              cx={FAB_SIZE / 2}
              cy={FAB_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="#f6ba32"
              strokeWidth={3}
              strokeDasharray={RING_CIRC}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>

          {/* botão expandir */}
          <button
            onClick={() => setExpanded(true)}
            aria-label="Expandir player"
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 22,
              height: 22,
              borderRadius: "50%",
              backgroundColor: "#f6ba32",
              color: "#1c1915",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              padding: 0,
            }}
          >
            <ChevronDown className="h-3 w-3 rotate-180" />
          </button>

          <style>{`
            @keyframes fabPulse {
              0%, 100% { box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 0 rgba(246,186,50,0.45); }
              50% { box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 8px rgba(246,186,50,0); }
            }
          `}</style>
        </div>
      ) : (
        // ============ Card expandido ============
        <div
          style={{
            width: "min(360px, calc(100vw - 24px))",
            backgroundColor: "#1c1915",
            border: "1px solid rgba(246,186,50,0.35)",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            color: "#f6ba32",
            padding: 12,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm font-medium flex-1 truncate" style={{ color: "#f6ba32" }}>
              🎧 {licaoTitulo}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setExpanded(false)}
              className="h-7 w-7 hover:bg-[rgba(246,186,50,0.15)]"
              style={{ color: "#f6ba32" }}
              aria-label="Minimizar player"
            >
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => skip(-15)}
              className="h-9 w-9 border-[rgba(246,186,50,0.35)] hover:bg-[rgba(246,186,50,0.15)]"
              style={{ backgroundColor: "transparent", color: "#f6ba32" }}
            >
              <Rewind className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              onClick={togglePlay}
              className="h-11 w-11 rounded-full hover:opacity-90"
              style={{ backgroundColor: "#f6ba32", color: "#1c1915" }}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => skip(15)}
              className="h-9 w-9 border-[rgba(246,186,50,0.35)] hover:bg-[rgba(246,186,50,0.15)]"
              style={{ backgroundColor: "transparent", color: "#f6ba32" }}
            >
              <FastForward className="h-4 w-4" />
            </Button>

            <Select value={String(speed)} onValueChange={onSpeed}>
              <SelectTrigger
                className="h-8 w-[64px] text-xs ml-auto border-[rgba(246,186,50,0.35)]"
                style={{ backgroundColor: "transparent", color: "#f6ba32" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEEDS.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}x</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums" style={{ color: "rgba(246,186,50,0.7)" }}>
              {fmt(current)}
            </span>
            <Slider
              value={[current]}
              max={duration || 1}
              step={0.5}
              onValueChange={onSeek}
              className="flex-1"
            />
            <span className="text-xs tabular-nums" style={{ color: "rgba(246,186,50,0.7)" }}>
              {fmt(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
