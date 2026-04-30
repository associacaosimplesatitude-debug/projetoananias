import { useEffect, useRef, useState } from "react";
import { Play, Pause, Rewind, FastForward, ChevronDown, ChevronUp, AudioLines } from "lucide-react";
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

function fmt(t: number) {
  if (!isFinite(t)) return "00:00";
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function LicaoAudioPlayer({ audioUrl, licaoId, licaoTitulo }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { activeLicaoId, visibleLicaoId, registerActive, unregisterActive } = useLicaoAudioCtx();

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [expanded, setExpanded] = useState(true);
  const [isStuck, setIsStuck] = useState(false);

  // Persistir posição
  const storageKey = `licao_audio_pos_${licaoId}`;

  useEffect(() => {
    const saved = parseFloat(localStorage.getItem(storageKey) || "0");
    if (saved > 0 && audioRef.current) {
      audioRef.current.currentTime = saved;
      setCurrent(saved);
    }
  }, [storageKey]);

  // salvar posição a cada 5s
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (audioRef.current) {
        localStorage.setItem(storageKey, String(audioRef.current.currentTime));
      }
    }, 5000);
    return () => clearInterval(id);
  }, [playing, storageKey]);

  // detect sticky via sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: [0], rootMargin: "0px 0px 0px 0px" },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, []);

  // se outro player virar ativo, pausar este
  useEffect(() => {
    if (activeLicaoId && activeLicaoId !== licaoId && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [activeLicaoId, licaoId]);

  // se essa lição não é mais a visível, recolher para compacto
  const sticky = isStuck && visibleLicaoId === licaoId;
  const showCompact = sticky && !expanded;

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

  return (
    <>
      {/* Sentinel acima do player para detectar quando ficou sticky */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      <div
        ref={containerRef}
        data-licao-audio={licaoId}
        className="bg-card border border-border rounded-lg shadow-sm"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          margin: "8px 0",
        }}
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

        {showCompact ? (
          // ========= COMPACTO =========
          <div className="flex items-center gap-2 px-3 py-2 h-14">
            <Button size="icon" variant="ghost" onClick={togglePlay} className="h-9 w-9 shrink-0">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{licaoTitulo}</div>
              <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setExpanded(true)} className="h-8 w-8 shrink-0">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          // ========= COMPLETO =========
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-primary" />
              <div className="text-sm font-medium flex-1 truncate">🎧 {licaoTitulo}</div>
              {sticky && (
                <Button size="icon" variant="ghost" onClick={() => setExpanded(false)} className="h-7 w-7">
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={() => skip(-15)} className="h-9 w-9">
                <Rewind className="h-4 w-4" />
              </Button>
              <Button size="icon" onClick={togglePlay} className="h-11 w-11 rounded-full">
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button size="icon" variant="outline" onClick={() => skip(15)} className="h-9 w-9">
                <FastForward className="h-4 w-4" />
              </Button>

              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-xs tabular-nums text-muted-foreground">{fmt(current)}</span>
                <Slider
                  value={[current]}
                  max={duration || 1}
                  step={0.5}
                  onValueChange={onSeek}
                  className="flex-1"
                />
                <span className="text-xs tabular-nums text-muted-foreground">{fmt(duration)}</span>
              </div>

              <Select value={String(speed)} onValueChange={onSpeed}>
                <SelectTrigger className="h-8 w-[72px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEEDS.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
