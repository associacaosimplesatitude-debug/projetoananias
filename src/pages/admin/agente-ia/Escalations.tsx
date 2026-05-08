import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

const PRIO_COLOR: Record<string, string> = {
  urgente: "bg-red-100 text-red-800 border-red-300",
  alta: "bg-orange-100 text-orange-800 border-orange-300",
  normal: "bg-blue-100 text-blue-800 border-blue-300",
  baixa: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function AgenteIAEscalations() {
  const [status, setStatus] = useState("aberta");
  const [prioridade, setPrioridade] = useState("all");
  const [motivo, setMotivo] = useState("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["agente-ia-escalations", status, prioridade, motivo],
    refetchInterval: 15_000,
    queryFn: async () => {
      let q = supabase
        .from("agente_ia_escalations")
        .select("*, conversa:conversa_id(telefone, ebd_clientes:cliente_id(nome_igreja)), vendedor:vendedor_alvo_id(nome)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      if (prioridade !== "all") q = q.eq("prioridade", prioridade);
      if (motivo !== "all") q = q.eq("motivo", motivo);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap gap-2">
        <Select label="Status" value={status} onChange={setStatus} options={[
          ["all","Todos"], ["aberta","Aberta"], ["em_atendimento","Em atendimento"], ["resolvida","Resolvida"], ["cancelada","Cancelada"],
        ]}/>
        <Select label="Prioridade" value={prioridade} onChange={setPrioridade} options={[
          ["all","Todas"], ["urgente","Urgente"], ["alta","Alta"], ["normal","Normal"], ["baixa","Baixa"],
        ]}/>
        <Select label="Motivo" value={motivo} onChange={setMotivo} options={[
          ["all","Todos"],
          ["cliente_solicitou_humano","Cliente pediu humano"],
          ["reembolso_devolucao_troca","Reembolso/troca"],
          ["produto_defeituoso","Produto defeituoso"],
          ["cancelamento_pedido_pago","Cancelamento pago"],
          ["alteracao_nfe","Alteração NF-e"],
          ["cliente_emocional","Cliente emocional"],
          ["fora_de_escopo","Fora do escopo"],
          ["limite_turnos_excedido","Limite turnos"],
          ["erro_tecnico_persistente","Erro técnico"],
          ["outro","Outro"],
        ]}/>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma escalation</TableCell></TableRow>}
            {data.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="text-sm font-medium">{e.conversa?.ebd_clientes?.nome_igreja ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{e.conversa?.telefone}</div>
                </TableCell>
                <TableCell className="text-sm">{e.vendedor?.nome ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{e.motivo}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={PRIO_COLOR[e.prioridade] ?? ""}>{e.prioridade}</Badge></TableCell>
                <TableCell className="text-xs">{formatDistanceToNow(new Date(e.created_at), { locale: ptBR, addSuffix: true })}</TableCell>
                <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
                <TableCell>
                  <Link to={`/admin/agente-ia/conversas/${e.conversa_id}`}>
                    <Button size="sm" variant="outline">Ver conversa</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 border rounded-md px-2 bg-background text-sm">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
