import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  value: number;
  min?: number;
  onCommit: (next: number) => void;
  className?: string;
};

export function CartQuantityField({ value, min = 1, onCommit, className }: Props) {
  const [draft, setDraft] = useState<string>(String(value));

  // Keep in sync when value changes externally (+/- buttons or other updates)
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const normalizedMin = useMemo(() => (Number.isFinite(min) ? min : 1), [min]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(String(value));
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }

    const next = Math.max(normalizedMin, parsed);
    if (next !== value) onCommit(next);
    setDraft(String(next));
  };

  return (
    <Input
      inputMode="numeric"
      type="number"
      min={normalizedMin}
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
      className={
        className ??
        "w-10 h-6 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      }
      aria-label="Quantidade"
    />
  );
}
