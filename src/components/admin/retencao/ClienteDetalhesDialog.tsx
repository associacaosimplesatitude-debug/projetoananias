import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, MessageSquare, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { KanbanCliente } from "./RetencaoKanban";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: KanbanCliente | null;
  autoRepliedAt?: string;
  licencaConcedidaAt?: string;
  disparoAt?: string;
}

const formatPhone = (raw?: string | null) => {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

const formatCNPJ = (v?: string | null) => {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v;
};

const copy = (val: string, label: string) => {
  navigator.clipboard.writeText(val);
  toast.success(`${label} copiado`);
};

const Row = ({ label, value, copyValue }: { label: string; value: React.ReactNode; copyValue?: string }) => (
  <div className="flex items-start justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <div className="flex items-center gap-1 text-sm text-right">
      <span className="break-all">{value}</span>
      {copyValue && (
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copy(copyValue, label)}>
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  </div>
);

export function ClienteDetalhesDialog({ open, onOpenChange, cliente, autoRepliedAt, licencaConcedidaAt, disparoAt }: Props) {
  const { data: extra } = useQuery({
    queryKey: ["cliente-detalhes", cliente?.cliente_id],
    enabled: open && !!cliente?.cliente_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("cnpj, cpf, nome_responsavel, nome_superintendente, email_superintendente, endereco_cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, dia_aula, data_inicio_ebd, ultimo_login")
        .eq("id", cliente!.cliente_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!cliente) return null;

  const phoneDigits = cliente.telefone?.replace(/\D/g, "") || "";
  const enderecoCompleto = extra
    ? [extra.endereco_rua, extra.endereco_numero, extra.endereco_complemento, extra.endereco_bairro]
        .filter(Boolean).join(", ")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{cliente.nome_igreja}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contato */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Contato</h4>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-semibold tracking-wide select-all">
                    {formatPhone(cliente.telefone)}
                  </span>
                </div>
                <div className="flex gap-1">
                  {cliente.telefone && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copy(phoneDigits, "Telefone")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                        <a href={`https://wa.me/55${phoneDigits}`} target="_blank" rel="noopener noreferrer">
                          <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {cliente.email && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{cliente.email}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copy(cliente.email!, "E-mail")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                      <a href={`mailto:${cliente.email}`}><Mail className="h-3.5 w-3.5" /></a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Comercial */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Comercial</h4>
            <div className="rounded-lg border bg-muted/30 px-3">
              <Row label="Canal última compra" value={<Badge variant="outline" className="text-xs">{cliente.canal_ultima_compra}</Badge>} />
              <Row label="Vendedor" value={cliente.vendedor_nome || "—"} />
              <Row label="Total compras" value={`R$ ${(cliente.valor_total_compras ?? cliente.valor_medio).toFixed(2)}`} />
              {cliente.valor_ultima_compra != null && (
                <Row label="Última compra" value={`R$ ${cliente.valor_ultima_compra.toFixed(2)}`} />
              )}
              <Row label="Dias sem comprar" value={<Badge variant="destructive" className="text-xs">{cliente.dias_sem_compra}d</Badge>} />
              {cliente.dias_para_fechar != null && (
                <Row label="Fechou em" value={`${cliente.dias_para_fechar} dias`} />
              )}
            </div>
          </section>

          {/* Cadastro */}
          {extra && (
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Cadastro</h4>
              <div className="rounded-lg border bg-muted/30 px-3">
                {extra.nome_responsavel && <Row label="Responsável" value={extra.nome_responsavel} />}
                {extra.nome_superintendente && <Row label="Superintendente" value={extra.nome_superintendente} />}
                {extra.cnpj && <Row label="CNPJ" value={formatCNPJ(extra.cnpj)} copyValue={extra.cnpj} />}
                {extra.cpf && <Row label="CPF" value={formatCNPJ(extra.cpf)} copyValue={extra.cpf} />}
                {extra.dia_aula && <Row label="Dia da aula" value={extra.dia_aula} />}
                {extra.ultimo_login && (
                  <Row label="Último login" value={format(new Date(extra.ultimo_login), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
                )}
              </div>
            </section>
          )}

          {/* Endereço */}
          {extra && (enderecoCompleto || extra.endereco_cidade) && (
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Endereço</h4>
              <div className="rounded-lg border bg-muted/30 px-3">
                {enderecoCompleto && <Row label="Logradouro" value={enderecoCompleto} />}
                {(extra.endereco_cidade || extra.endereco_estado) && (
                  <Row label="Cidade/UF" value={`${extra.endereco_cidade ?? ""}${extra.endereco_estado ? "/" + extra.endereco_estado : ""}`} />
                )}
                {extra.endereco_cep && <Row label="CEP" value={extra.endereco_cep} copyValue={extra.endereco_cep} />}
              </div>
            </section>
          )}

          {/* Retenção */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Retenção</h4>
            <div className="rounded-lg border bg-muted/30 px-3">
              {cliente.ultimo_resultado && <Row label="Último resultado" value={cliente.ultimo_resultado} />}
              {cliente.ultimo_contato_data && (
                <Row label="Último contato" value={format(new Date(cliente.ultimo_contato_data), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
              )}
              {disparoAt && (
                <Row label="Mensagem enviada" value={format(new Date(disparoAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
              )}
              {autoRepliedAt && (
                <Row label="Interesse respondido" value={format(new Date(autoRepliedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
              )}
              {licencaConcedidaAt && (
                <Row label="Acesso liberado" value={format(new Date(licencaConcedidaAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
