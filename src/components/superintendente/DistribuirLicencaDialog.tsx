import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Country = "BR" | "PT" | "US";

const COUNTRY_META: Record<Country, { label: string; iso: string; ddi: string; expectedLen: number; placeholder: string; hint: string }> = {
  BR: { label: "Brasil", iso: "br", ddi: "+55", expectedLen: 11, placeholder: "(11) 99999-9999", hint: "11 dígitos: DDD (2) + número (9)" },
  PT: { label: "Portugal", iso: "pt", ddi: "+351", expectedLen: 9, placeholder: "9XX XXX XXX", hint: "9 dígitos, começando com 9" },
  US: { label: "EUA", iso: "us", ddi: "+1", expectedLen: 10, placeholder: "(555) 123-4567", hint: "10 dígitos: area code (3) + número (7)" },
};

function validatePhoneByCountry(country: Country, digits: string): string | null {
  const meta = COUNTRY_META[country];
  if (digits.length === 0) return "Informe o número de WhatsApp";
  if (digits.length !== meta.expectedLen) {
    return `Número de ${meta.label} deve ter ${meta.expectedLen} dígitos (você digitou ${digits.length}).`;
  }
  if (country === "BR") {
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (ddd < 11 || ddd > 99) return "DDD inválido. DDDs brasileiros vão de 11 a 99.";
    if (digits[2] !== "9") return "Celular brasileiro deve começar com 9 após o DDD.";
  }
  if (country === "PT") {
    if (digits[0] !== "9") return "Celular português deve começar com 9.";
  }
  if (country === "US") {
    if (digits[0] === "0" || digits[0] === "1") return "Area code americano não pode começar com 0 ou 1.";
  }
  return null;
}

const schema = z.object({
  aluno_nome: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  aluno_email: z.string().email("E-mail inválido"),
  aluno_country: z.enum(["BR", "PT", "US"]),
  aluno_whatsapp: z.string(),
}).superRefine((data, ctx) => {
  const digits = data.aluno_whatsapp.replace(/\D/g, "");
  const err = validatePhoneByCountry(data.aluno_country as Country, digits);
  if (err) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["aluno_whatsapp"], message: err });
  }
});

type FormData = z.infer<typeof schema>;

interface Props {
  licencaId: string;
  revistaTitulo: string;
  disponiveis: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function maskPhone(country: Country, value: string) {
  const max = COUNTRY_META[country].expectedLen;
  const d = value.replace(/\D/g, "").slice(0, max);
  if (country === "BR") {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (country === "PT") {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  // US
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function CountryFlag({ country }: { country: Country }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${COUNTRY_META[country].iso}.png`}
      alt={COUNTRY_META[country].label}
      width={20}
      height={15}
      className="inline-block rounded-sm shadow-sm"
    />
  );
}

export function DistribuirLicencaDialog({
  licencaId,
  revistaTitulo,
  disponiveis,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { aluno_nome: "", aluno_email: "", aluno_country: "BR", aluno_whatsapp: "" },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const phoneDigits = data.aluno_whatsapp.replace(/\D/g, "");
      const { data: resp, error } = await supabase.functions.invoke(
        "provisionar-licenca-aluno-se",
        {
          body: {
            licenca_id: licencaId,
            aluno_nome: data.aluno_nome.trim(),
            aluno_email: data.aluno_email.trim().toLowerCase(),
            aluno_whatsapp: phoneDigits,
          },
        }
      );

      if (error) {
        // Edge Function retornou status != 2xx
        const ctx: any = (error as any).context;
        let msg = error.message || "Erro ao distribuir licença";
        let status = 0;
        try {
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            msg = body?.error || msg;
            status = ctx.status || 0;
          } else if (ctx?.body) {
            const parsed = JSON.parse(ctx.body);
            msg = parsed?.error || msg;
            status = ctx.status || 0;
          }
        } catch {
          /* ignore */
        }

        if (status === 409) {
          if (/duplic|já cadastrado|ja cadastrado/i.test(msg)) {
            toast.error("Aluno já cadastrado neste pacote");
          } else if (/pool/i.test(msg)) {
            toast.error("Pool de licenças esgotado");
          } else {
            toast.error(msg);
          }
        } else if (status === 403) {
          toast.error("Você não tem permissão para essa licença");
        } else {
          toast.error(msg);
        }
        return;
      }

      if (resp?.ok) {
        toast.success(
          `Licença distribuída para ${data.aluno_nome.trim()}. Email e WhatsApp enviados.`
        );
        reset();
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(resp?.error || "Resposta inesperada");
      }
    } catch (err: any) {
      console.error("[DistribuirLicencaDialog]", err);
      toast.error(err?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const phoneVal = watch("aluno_whatsapp") || "";
  const country = (watch("aluno_country") || "BR") as Country;
  const meta = COUNTRY_META[country];

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Distribuir licença — {revistaTitulo}</DialogTitle>
          <DialogDescription>
            Você tem <strong>{disponiveis}</strong>{" "}
            {disponiveis === 1 ? "licença disponível" : "licenças disponíveis"}.
            Preencha os dados do aluno abaixo. Ele receberá o acesso por email e
            WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aluno_nome">Nome do aluno</Label>
            <Input
              id="aluno_nome"
              placeholder="Nome completo"
              autoFocus
              {...register("aluno_nome")}
            />
            {errors.aluno_nome && (
              <p className="text-xs text-destructive">{errors.aluno_nome.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="aluno_email">E-mail</Label>
            <Input
              id="aluno_email"
              type="email"
              placeholder="email@exemplo.com"
              {...register("aluno_email")}
            />
            {errors.aluno_email && (
              <p className="text-xs text-destructive">{errors.aluno_email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="aluno_whatsapp">WhatsApp</Label>
            <div className="flex gap-2">
              <select
                aria-label="País"
                className="flex h-10 items-center gap-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={country}
                onChange={(e) => {
                  const next = e.target.value as Country;
                  setValue("aluno_country", next, { shouldValidate: true });
                  setValue("aluno_whatsapp", "", { shouldValidate: false });
                }}
              >
                <option value="BR">🇧🇷 +55 Brasil</option>
                <option value="PT">🇵🇹 +351 Portugal</option>
                <option value="US">🇺🇸 +1 EUA</option>
              </select>
              <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
                <CountryFlag country={country} />
                <span className="text-sm text-muted-foreground">{meta.ddi}</span>
                <Input
                  id="aluno_whatsapp"
                  placeholder={meta.placeholder}
                  inputMode="tel"
                  value={phoneVal}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
                  onChange={(e) =>
                    setValue("aluno_whatsapp", maskPhone(country, e.target.value), {
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{meta.hint}</p>
            {errors.aluno_whatsapp && (
              <p className="text-xs text-destructive">{errors.aluno_whatsapp.message}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Distribuir licença
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
