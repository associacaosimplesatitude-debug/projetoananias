import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

interface AlunoInfo {
  id: string;
  aluno_nome: string;
  aluno_email: string | null;
  aluno_telefone: string | null;
  primeiro_acesso_em: string | null;
}

interface Props {
  aluno: AlunoInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RemoverAlunoDialog({ aluno, open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const jaAcessou = !!aluno.primeiro_acesso_em;
  const modo: "devolver" | "desativar" = jaAcessou ? "desativar" : "devolver";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke(
        "remover-licenca-aluno-se",
        {
          body: { aluno_licenca_id: aluno.id, modo },
        }
      );

      if (error) {
        const ctx: any = (error as any).context;
        let msg = error.message || "Erro ao remover";
        try {
          if (ctx?.json) {
            const body = await ctx.json();
            msg = body?.error || msg;
          }
        } catch {
          /* ignore */
        }
        toast.error(msg);
        return;
      }

      if (resp?.ok) {
        toast.success(
          modo === "devolver"
            ? "Leitor removido. Licença devolvida ao pacote."
            : "Acesso desativado."
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(resp?.error || "Resposta inesperada");
      }
    } catch (err: any) {
      console.error("[RemoverAlunoDialog]", err);
      toast.error(err?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {jaAcessou ? "Desativar acesso do leitor?" : "Remover leitor?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {jaAcessou ? (
                <>
                  <p>
                    <strong>{aluno.aluno_nome}</strong> já acessou a revista pela
                    primeira vez em{" "}
                    {aluno.primeiro_acesso_em
                      ? format(new Date(aluno.primeiro_acesso_em), "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "—"}
                    . Por isso, ao remover, o acesso dele será{" "}
                    <strong>desativado</strong> mas a licença NÃO retorna ao seu
                    pacote (o aluno já consumiu o slot).
                  </p>
                  <p className="font-semibold text-destructive">
                    Essa ação não pode ser desfeita.
                  </p>
                </>
              ) : (
                <p>
                  Você está prestes a remover <strong>{aluno.aluno_nome}</strong>{" "}
                  do seu pacote. Como o leitor ainda não acessou a revista, a
                  licença será <strong>devolvida ao seu pacote</strong> e você
                  poderá usá-la para outro leitor.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {jaAcessou ? "Desativar acesso" : "Remover e devolver licença"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
