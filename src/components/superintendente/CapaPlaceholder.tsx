import { BookOpen, Book, BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface CapaPlaceholderProps {
  tipo: string | null | undefined;
  size: "sm" | "lg";
  className?: string;
}

const TIPO_STYLES: Record<
  string,
  { bg: string; fg: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  revista: { bg: "bg-blue-100", fg: "text-blue-700", Icon: BookOpen },
  livro_digital: { bg: "bg-amber-100", fg: "text-amber-700", Icon: Book },
  infografico: { bg: "bg-emerald-100", fg: "text-emerald-700", Icon: BarChart3 },
};

const FALLBACK = { bg: "bg-slate-100", fg: "text-slate-500", Icon: FileText };

export function CapaPlaceholder({ tipo, size, className }: CapaPlaceholderProps) {
  const style = (tipo && TIPO_STYLES[tipo]) || FALLBACK;
  const { bg, fg, Icon } = style;

  if (size === "sm") {
    return (
      <div
        className={cn(
          "h-20 w-[60px] rounded-md flex items-center justify-center shrink-0",
          bg,
          className,
        )}
      >
        <Icon className={cn("h-6 w-6", fg)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full h-[200px] rounded-t-lg flex items-center justify-center",
        bg,
        className,
      )}
    >
      <Icon className={cn("h-16 w-16", fg)} />
    </div>
  );
}

export function tipoLabel(tipo: string | null | undefined): string {
  switch (tipo) {
    case "revista":
      return "Revista";
    case "livro_digital":
      return "Livro";
    case "infografico":
      return "Infográfico";
    default:
      return "Outro";
  }
}

export function tipoBadgeClass(tipo: string | null | undefined): string {
  switch (tipo) {
    case "revista":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200";
    case "livro_digital":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200";
    case "infografico":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200";
  }
}
