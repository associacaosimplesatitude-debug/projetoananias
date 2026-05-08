import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

type Periodo = "hoje" | "7d" | "30d" | "all";

export default function AgenteIAConversas() {
  const [status, setStatus] = useState<string>("all");
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [gerouVenda, setGerouVenda] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["agente-ia-conversas", status, periodo, gerouVenda, search, page],
    queryFn: async () => {
      let q = supabase
        .from("agente_ia_conversas")
        .select(
          "id, telefone, status, iniciada_em, total_turnos, resolveu_sozinho, gerou_venda, valor_venda, cliente_id, ebd_clientes:cliente_id(nome_igreja)",
          { count: "exact" },
        )
        .order("iniciada_em", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (status !== "all") q = q.eq("status", status);
      if (gerouVenda === "sim") q = q.eq("gerou_venda", true);
      if (gerouVenda === "nao") q = q.eq("gerou_venda", false);

      if (periodo !== "all") {
        const days = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
        q = q.gte("iniciada_em", subDays(new Date(), days).toISOString());
      }

      if (search.trim()) q = q.ilike("telefone", `%${search.trim()}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as any[], count: count ?? 0 };
    },
  });

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[11px] text-muted-foreground">Status</label>
          <select className="block h-9 border rounded-md px-2 bg-background" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos</option>
            <option value="ativa">Ativa</option>
            <option value="pausada_humano">Pausada</option>
            <option value="fechada">Fechada</option>
            <option value="escalada">Escalada</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Período</label>
          <select className="block h-9 border rounded-md px-2 bg-background" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            <option value="hoje">Hoje</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
            <option value="all">Tudo</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Gerou venda</label>
          <select className="block h-9 border rounded-md px-2 bg-background" value={gerouVenda} onChange={(e) => setGerouVenda(e.target.value)}>
            <option value="all">Qualquer</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] text-muted-foreground">Telefone / nome</label>
          <Input value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} placeholder="Buscar..." />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Iniciada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Turnos</TableHead>
              <TableHead>Resolveu sozinho</TableHead>
              <TableHead>Venda</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (data?.rows.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma conversa encontrada</TableCell></TableRow>
            )}
            {data?.rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium text-sm">{c.ebd_clientes?.nome_igreja ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.telefone}</div>
                </TableCell>
                <TableCell className="text-xs">{format(new Date(c.iniciada_em), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell className="text-right">{c.total_turnos ?? 0}</TableCell>
                <TableCell>{c.resolveu_sozinho === true ? "✓" : c.resolveu_sozinho === false ? "✗" : "—"}</TableCell>
                <TableCell>
                  {c.gerou_venda
                    ? <span className="text-green-600 font-medium">✓ R$ {Number(c.valor_venda ?? 0).toFixed(2)}</span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <Link to={`/admin/agente-ia/conversas/${c.id}`}>
                    <Button size="sm" variant="outline">Ver</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">{data?.count} resultados</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-xs self-center">Página {page + 1} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativa: "bg-green-100 text-green-800",
    pausada_humano: "bg-amber-100 text-amber-800",
    fechada: "bg-gray-100 text-gray-700",
    escalada: "bg-red-100 text-red-800",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}
