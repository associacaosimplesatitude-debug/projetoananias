import { createContext, useContext, useRef, useState, useCallback, ReactNode } from "react";

interface LicaoAudioContextValue {
  // qual licao_id está tocando agora
  activeLicaoId: string | null;
  // qual licao_id está visível na viewport (sticky)
  visibleLicaoId: string | null;
  registerActive: (licaoId: string, audioEl: HTMLAudioElement) => void;
  unregisterActive: (licaoId: string) => void;
  setVisibleLicao: (licaoId: string | null) => void;
}

const Ctx = createContext<LicaoAudioContextValue | null>(null);

export function LicaoAudioProvider({ children }: { children: ReactNode }) {
  const [activeLicaoId, setActiveLicaoId] = useState<string | null>(null);
  const [visibleLicaoId, setVisibleLicaoId] = useState<string | null>(null);
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const registerActive = useCallback((licaoId: string, audioEl: HTMLAudioElement) => {
    // Pausa todos os outros
    audiosRef.current.forEach((el, id) => {
      if (id !== licaoId && !el.paused) {
        el.pause();
      }
    });
    audiosRef.current.set(licaoId, audioEl);
    setActiveLicaoId(licaoId);
  }, []);

  const unregisterActive = useCallback((licaoId: string) => {
    setActiveLicaoId((cur) => (cur === licaoId ? null : cur));
  }, []);

  const setVisibleLicao = useCallback((licaoId: string | null) => {
    setVisibleLicaoId(licaoId);
  }, []);

  return (
    <Ctx.Provider value={{ activeLicaoId, visibleLicaoId, registerActive, unregisterActive, setVisibleLicao }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLicaoAudioCtx() {
  const v = useContext(Ctx);
  if (!v) {
    // fallback no-op para uso fora de provider
    return {
      activeLicaoId: null,
      visibleLicaoId: null,
      registerActive: () => {},
      unregisterActive: () => {},
      setVisibleLicao: () => {},
    } as LicaoAudioContextValue;
  }
  return v;
}
