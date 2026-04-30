import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreVertical, Search, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { RemoverAlunoDialog } from "./RemoverAlunoDialog";

interface Props {
  licencaId: string;
  onPoolChanged: () => void;
}

interface AlunoRow {
  id: string;
  aluno_nome: string;
  aluno_email: string | null;
  aluno_telefone: string | null;
  status: string;
  created_at: string;
  shopify_id: string | null;
  primeiro_acesso_em: string | null;
  shopify_ativo: boolean | null;
}

function formatPhone(phone?: string | null) {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export function AlunosLista({ licencaId, onPoolChanged }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AlunoRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["superintendente", "alunos", licencaId],
    queryFn: async (): Promise<AlunoRow[]> => {
      // 1) alunos do pacote
      const { data: alunos, error: errA } = await supabase
        .from("revista_licenca_alunos")
        .select("id, aluno_nome, aluno_email, aluno_telefone, status, created_at")
        .eq("licenca_id", licencaId)
        .order("created_at", { ascending: false });
      if (errA) throw errA;
      const list = alunos || [];

      // 2) shopify licenses correspondentes via shopify_order_id = SE-{aluno.id}
      const ids = list.map((a) => `SE-${a.id}`);
      let shopByOrderId: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: shop } = await supabase
          .from("revista_licencas_shopify")
          .select("id, shopify_order_id, primeiro_acesso_em, ativo")
          .in("shopify_order_id", ids);
        (shop || []).forEach((s: any) => {
          if (s.shopify_order_id) shopByOrderId[s.shopify_order_id] = s;
        });
      }

      return list.map((a) => {
        const s = shopByOrderId[`SE-${a.id}`];
        return {
          id: a.id,
          aluno_nome: a.aluno_nome,
          aluno_email: a.aluno_email,
          aluno_telefone: a.aluno_telefone,
          status: a.status,
          created_at: a.created_at,
          shopify_id: s?.id ?? null,
          primeiro_acesso_em: s?.primeiro_acesso_em ?? null,
          shopify_ativo: s?.ativo ?? null,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (a) =>
        a.aluno_nome.toLowerCase().includes(q) ||
        (a.aluno_email || "").toLowerCase().includes(q) ||
        (a.aluno_telefone || "").includes(q)
    );
  }, [data, search]);

  const handleResend = async (aluno: AlunoRow) => {
    if (!aluno.shopify_id) {
      toast.error("Licença shopify não encontrada para reenvio");
      return;
    }
    setResendingId(aluno.id);
    try {
      const { data: resp, error } = await supabase.functions.invoke(
        "revista-licencas-shopify-admin",
        {
          body: { action: "resend", licenca_id: aluno.shopify_id },
        }
      );
      if (error) {
        const ctx: any = (error as any).context;
        let msg = error.message || "Erro ao reenviar";
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
      if (resp?.ok || resp?.success) {
        toast.success("Acesso reenviado por email e WhatsApp.");
      } else {
        toast.success("Reenvio solicitado.");
      }
    } catch (err: any) {
      console.error("[AlunosLista resend]", err);
      toast.error(err?.message || "Erro inesperado");
    } finally {
      setResendingId(null);
    }
  };

  const handleRemoveSuccess = () => {
    qc.invalidateQueries({ queryKey: ["superintendente", "alunos", licencaId] });
    onPoolChanged();
  };

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-4 p-6 text-center border rounded-md bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Nenhum leitor cadastrado ainda. Clique em <strong>Distribuir Licença</strong>{" "}
          para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email ou WhatsApp"
          className="pl-9"
        />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.map((aluno) => (
          <AlunoCardMobile
            key={aluno.id}
            aluno={aluno}
            resending={resendingId === aluno.id}
            onResend={() => handleResend(aluno)}
            onRemove={() => setRemoveTarget(aluno)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum leitor encontrado.
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Cadastrado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((aluno) => (
              <TableRow key={aluno.id}>
                <TableCell className="font-medium">{aluno.aluno_nome}</TableCell>
                <TableCell className="text-sm">{aluno.aluno_email || "—"}</TableCell>
                <TableCell className="text-sm">
                  {formatPhone(aluno.aluno_telefone)}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(aluno.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <StatusBadge aluno={aluno} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {resendingId === aluno.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreVertical className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleResend(aluno)}
                        disabled={!aluno.shopify_id}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reenviar acesso
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setRemoveTarget(aluno)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover leitor
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                  Nenhum leitor encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {removeTarget && (
        <RemoverAlunoDialog
          aluno={{
            id: removeTarget.id,
            aluno_nome: removeTarget.aluno_nome,
            aluno_email: removeTarget.aluno_email,
            aluno_telefone: removeTarget.aluno_telefone,
            primeiro_acesso_em: removeTarget.primeiro_acesso_em,
          }}
          open={!!removeTarget}
          onOpenChange={(o) => !o && setRemoveTarget(null)}
          onSuccess={handleRemoveSuccess}
        />
      )}
    </div>
  );
}

function StatusBadge({ aluno }: { aluno: AlunoRow }) {
  if (aluno.status === "desativado" || aluno.shopify_ativo === false) {
    return <Badge variant="outline" className="text-muted-foreground">Desativado</Badge>;
  }
  if (aluno.primeiro_acesso_em) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
        Acessou em {format(new Date(aluno.primeiro_acesso_em), "dd/MM/yyyy", { locale: ptBR })}
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
      Aguardando primeiro acesso
    </Badge>
  );
}

function AlunoCardMobile({
  aluno,
  resending,
  onResend,
  onRemove,
}: {
  aluno: AlunoRow;
  resending: boolean;
  onResend: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="border rounded-md p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{aluno.aluno_nome}</p>
          <p className="text-xs text-muted-foreground truncate">
            {aluno.aluno_email || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatPhone(aluno.aluno_telefone)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-1">
              {resending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onResend} disabled={!aluno.shopify_id}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reenviar acesso
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover leitor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge aluno={aluno} />
        <span className="text-[11px] text-muted-foreground">
          {format(new Date(aluno.created_at), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}
