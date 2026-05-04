import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNovidades } from "@/hooks/useNovidades";
import { NovidadesModal } from "./NovidadesModal";

export function NovidadesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { naoLidasCount } = useNovidades();

  const badgeText = naoLidasCount === 0 ? null : naoLidasCount > 9 ? "9+" : String(naoLidasCount);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100",
          className,
        )}
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Novidades</span>
        {badgeText && (
          <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">
            {badgeText}
          </span>
        )}
      </button>
      <NovidadesModal open={open} onOpenChange={setOpen} />
    </>
  );
}
