import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, AlertTriangle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface AuditRow {
  id: string;
  proposta_id: string;
  action: string;
  old_data: any;
  new_data: any;
  user_id: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: "Criou proposta", color: "bg-blue-500" },
  MARCAR_PAGO: { label: "Marcou como PAGO", color: "bg-red-600" },
  CANCELAR: { label: "Cancelou", color: "bg-orange-500" },
  EDIT_VALOR: { label: "Editou valor", color: "bg-amber-500" },
  EDIT_PRAZO_FATURAMENTO: { label: "Definiu prazo de faturamento", color: "bg-amber-500" },
  BLING_LINK: { label: "Vinculou ao Bling", color: "bg-emerald-600" },
  DUPLICATA_SUSPEITA: { label: "⚠️ Duplicata suspeita", color: "bg-red-700" },
  UPDATE: { label: "Editou", color: "bg-slate-500" },
  DELETE: { label: "Excluiu", color: "bg-black" },
};

function actionInfo(action: string) {
  if (action.startsWith("STATUS_CHANGE")) {
    const parts = action.replace("STATUS_CHANGE:", "").split("->");
    return { label: `Status: ${parts[0]} → ${parts[1]}`, color: "bg-purple-500" };
  }
  return ACTION_LABELS[action] || { label: action, color: "bg-slate-500" };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(v: any) {
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

// Campos legíveis para humanos com label e formatador
const FRIENDLY_FIELDS: Record<string, { label: string; format?: (v: any) => string }> = {
  status: { label: "Status" },
  valor_total: { label: "Valor total", format: fmtMoney },
  valor_produtos: { label: "Valor produtos", format: fmtMoney },
  valor_frete: { label: "Frete", format: fmtMoney },
  desconto_percentual: { label: "Desconto %", format: (v) => `${v}%` },
  prazo_faturamento_selecionado: { label: "Prazo faturamento" },
  bling_order_number: { label: "Pedido Bling" },
  bling_status: { label: "Status Bling" },
  comissao_aprovada: { label: "Comissão aprovada", format: (v) => (v ? "Sim" : "Não") },
  metodo_frete: { label: "Método frete" },
  pode_faturar: { label: "Pode faturar", format: (v) => (v ? "Sim" : "Não") },
};

function buildSummary(action: string, oldData: any, newData: any): string[] {
  const lines: string[] = [];
  for (const [key, cfg] of Object.entries(FRIENDLY_FIELDS)) {
    const ov = oldData?.[key];
    const nv = newData?.[key];
    if (nv === undefined && ov === undefined) continue;
    if (action === "CREATE") {
      if (nv !== undefined && nv !== null && nv !== "") {
        lines.push(`${cfg.label}: ${cfg.format ? cfg.format(nv) : String(nv)}`);
      }
    } else if (ov !== undefined && nv !== undefined) {
      const ovs = cfg.format ? cfg.format(ov) : String(ov);
      const nvs = cfg.format ? cfg.format(nv) : String(nv);
      lines.push(`${cfg.label}: ${ovs} → ${nvs}`);
    } else if (nv !== undefined) {
      lines.push(`${cfg.label}: ${cfg.format ? cfg.format(nv) : String(nv)}`);
    }
  }
  return lines;
}


export default function AuditoriaVendedor() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");

  const { data: vendedores } = useQuery({
    queryKey: ["auditoria-vendedores"],
    queryFn: async () => {
      // Apenas vendedores reais (da tabela vendedores) que tenham login (profile)
      const [vendRes, profRes] = await Promise.all([
        supabase.from("vendedores").select("nome, email").eq("status", "ativo"),
        supabase.from("profiles").select("id, email"),
      ]);
      const profByEmail = new Map<string, string>();
      for (const p of profRes.data || []) {
        if (p.email) profByEmail.set(p.email.toLowerCase(), p.id);
      }
      const result: { user_id: string; nome: string }[] = [];
      const seen = new Set<string>();
      for (const v of vendRes.data || []) {
        const key = v.email?.toLowerCase();
        const uid = key ? profByEmail.get(key) : null;
        if (uid && !seen.has(uid)) {
          seen.add(uid);
          result.push({ user_id: uid, nome: v.nome });
        }
      }
      result.sort((a, b) => a.nome.localeCompare(b.nome));
      return result;
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["auditoria-vendedor-propostas", actionFilter, vendedorFilter],
    queryFn: async () => {
      let q = supabase
        .from("vendedor_propostas_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (vendedorFilter !== "all") q = q.eq("user_id", vendedorFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AuditRow[];
    },
  });

  const propostaIds = useMemo(
    () => Array.from(new Set((rows || []).map((r) => r.proposta_id).filter(Boolean))),
    [rows]
  );

  const { data: propostas } = useQuery({
    queryKey: ["auditoria-propostas", propostaIds],
    enabled: propostaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendedor_propostas")
        .select("id, cliente_nome, cliente_cnpj, valor_total, status, vendedor_nome")
        .in("id", propostaIds);
      const map: Record<string, any> = {};
      for (const p of data || []) map[p.id] = p;
      return map;
    },
  });

  const vendorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const v of vendedores || []) m[v.user_id] = v.nome;
    return m;
  }, [vendedores]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const p = propostas?.[r.proposta_id];
      return (
        r.proposta_id?.toLowerCase().includes(s) ||
        p?.cliente_nome?.toLowerCase().includes(s) ||
        p?.cliente_cnpj?.toLowerCase().includes(s) ||
        p?.vendedor_nome?.toLowerCase().includes(s) ||
        vendorMap[r.user_id || ""]?.toLowerCase().includes(s)
      );
    });
  }, [rows, search, propostas, vendorMap]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    (rows || []).forEach((r) => set.add(r.action));
    return Array.from(set).sort();
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Auditoria de Vendedores</h1>
          <p className="text-sm text-muted-foreground">
            Todas as ações em propostas: quem clicou, quando e o que mudou.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Buscar por cliente, CNPJ, vendedor, proposta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
            <SelectTrigger><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {(vendedores || []).map((v) => (
                <SelectItem key={v.user_id} value={v.user_id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Carregando..." : `${filtered.length} eventos`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum evento encontrado.
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const p = propostas?.[r.proposta_id];
                const userName = r.user_id
                  ? vendorMap[r.user_id] || `Usuário ${r.user_id.slice(0, 8)}`
                  : "Sistema/Automático";
                const isAlert =
                  r.action === "DUPLICATA_SUSPEITA" ||
                  (r.action === "MARCAR_PAGO" &&
                    !r.new_data?.prazo_faturamento_selecionado &&
                    !r.old_data?.prazo_faturamento_selecionado);
                const info = actionInfo(r.action);
                const summary = buildSummary(r.action, r.old_data, r.new_data);
                return (
                  <div
                    key={r.id}
                    className={`py-3 px-3 rounded-md ${isAlert ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge className={`${info.color} text-white`}>{info.label}</Badge>
                      {isAlert && <AlertTriangle className="h-4 w-4 text-red-600" />}
                      <span className="text-sm font-semibold">{userName}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                    </div>
                    {p && (
                      <Link
                        to={`/admin/ebd/propostas?id=${r.proposta_id}`}
                        className="text-sm text-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        <span className="font-medium">{p.cliente_nome}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{fmtMoney(p.valor_total)}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-xs">{p.status}</span>
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </Link>
                    )}
                    {summary.length > 0 && (
                      <ul className="mt-1 text-sm text-muted-foreground space-y-0.5">
                        {summary.map((line, i) => (
                          <li key={i}>• {line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
