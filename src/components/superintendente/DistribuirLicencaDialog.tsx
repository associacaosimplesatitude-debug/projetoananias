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

const schema = z.object({
  aluno_nome: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  aluno_email: z.string().email("E-mail inválido"),
  aluno_whatsapp: z
    .string()
    .min(10, "WhatsApp inválido")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "WhatsApp inválido"),
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

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
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
  } = useForm<FormData>({ resolver: zodResolver(schema) });

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
            <Input
              id="aluno_whatsapp"
              placeholder="(11) 99999-9999"
              inputMode="tel"
              value={phoneVal}
              onChange={(e) =>
                setValue("aluno_whatsapp", maskPhone(e.target.value), {
                  shouldValidate: true,
                })
              }
            />
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
