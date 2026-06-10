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

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-blue-500",
  MARCAR_PAGO: "bg-red-600",
  CANCELAR: "bg-orange-500",
  EDIT_VALOR: "bg-amber-500",
  EDIT_PRAZO_FATURAMENTO: "bg-amber-500",
  BLING_LINK: "bg-emerald-600",
  DUPLICATA_SUSPEITA: "bg-red-700",
  UPDATE: "bg-slate-500",
  DELETE: "bg-black",
};

function actionColor(action: string) {
  if (action.startsWith("STATUS_CHANGE")) return "bg-purple-500";
  return ACTION_COLORS[action] || "bg-slate-500";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function DiffViewer({ oldData, newData }: { oldData: any; newData: any }) {
  if (!oldData && !newData) return null;
  const keys = Array.from(
    new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])
  ).filter((k) => k !== "updated_at");

  if (keys.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 text-xs">
      {keys.map((k) => {
        const ov = oldData?.[k];
        const nv = newData?.[k];
        return (
          <div key={k} className="flex flex-wrap gap-1 items-baseline">
            <span className="font-mono font-semibold text-muted-foreground">{k}:</span>
            {ov !== undefined && (
              <span className="line-through text-red-600 break-all">
                {typeof ov === "object" ? JSON.stringify(ov) : String(ov)}
              </span>
            )}
            {ov !== undefined && nv !== undefined && <span>→</span>}
            {nv !== undefined && (
              <span className="text-emerald-700 font-medium break-all">
                {typeof nv === "object" ? JSON.stringify(nv) : String(nv)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditoriaVendedor() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");

  const { data: vendedores } = useQuery({
    queryKey: ["auditoria-vendedores"],
    queryFn: async () => {
      const [vendRes, profRes] = await Promise.all([
        supabase.from("vendedores").select("nome, email").order("nome"),
        supabase.from("profiles").select("id, email, full_name"),
      ]);
      const profileByEmail = new Map<string, { id: string; full_name: string | null }>();
      for (const p of profRes.data || []) {
        if (p.email) profileByEmail.set(p.email.toLowerCase(), { id: p.id, full_name: p.full_name });
      }
      const result: { user_id: string; nome: string }[] = [];
      for (const v of vendRes.data || []) {
        const prof = v.email ? profileByEmail.get(v.email.toLowerCase()) : null;
        if (prof) result.push({ user_id: prof.id, nome: v.nome });
      }
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
                return (
                  <div
                    key={r.id}
                    className={`py-3 px-2 ${isAlert ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`${actionColor(r.action)} text-white`}>
                        {r.action}
                      </Badge>
                      {isAlert && <AlertTriangle className="h-4 w-4 text-red-600" />}
                      <span className="text-sm font-medium">{userName}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                      {p && (
                        <Link
                          to={`/admin/ebd/propostas?id=${r.proposta_id}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {p.cliente_nome} · R$ {Number(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · {p.status}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {!p && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {r.proposta_id?.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <DiffViewer oldData={r.old_data} newData={r.new_data} />
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
