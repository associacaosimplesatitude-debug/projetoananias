import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Building, ShieldCheck, ShoppingCart, LogIn, Package, Truck, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { resolveLeadByPhone } from "@/lib/leadResolver";

interface LeadDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
}

export default function LeadDetailModal({ open, onOpenChange, phone }: LeadDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["lead-detail", phone],
    enabled: open && !!phone,
    queryFn: async () => {
      const resolved = await resolveLeadByPhone(phone);

      let ultimoPedido = null;
      if (resolved.clienteId) {
        const { data: propostas } = await supabase
          .from("vendedor_propostas")
          .select("id, status, valor_total, created_at, cliente_nome")
          .eq("cliente_id", resolved.clienteId)
          .order("created_at", { ascending: false })
          .limit(1);
        ultimoPedido = propostas?.[0] || null;
      }

      return { resolved, ultimoPedido };
    },
  });

  const resolved = data?.resolved;
  const cliente = resolved?.cliente;
  const lead = resolved?.lead;
  const pedidos = resolved?.pedidos || [];
  const ultimoPedido = data?.ultimoPedido;

  const nome = resolved?.nomeResolvido || null;
  const email = resolved?.emailResolvido || null;
  const documento = resolved?.documentoResolvido || null;
  const tipoCliente = resolved?.tipoCliente || null;
  const vendedor = resolved?.vendedorResolvido || null;
  const ultimoLogin = resolved?.ultimoLogin || null;
  const pedidoShopify = resolved?.pedidoShopify || null;
  const fontes = resolved?.fontes || [];

  const hasAnyData =
    !!resolved &&
    (resolved.nomeResolvido !== null ||
      resolved.clienteId !== null ||
      resolved.pedidoShopify !== null ||
      resolved.fontes.length > 0);

  const showFromLicencaShopifyBadge = hasAnyData && !fontes.includes("lead");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Lead
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAnyData ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Lead não encontrado para este telefone.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {showFromLicencaShopifyBadge && (
              <Badge variant="secondary" className="text-xs">
                Dados vindos de Licença/E-commerce — ainda não há registro na base de Leads
              </Badge>
            )}

            {/* Basic Info */}
            <Section title="Informações Gerais" icon={<Building className="h-4 w-4" />}>
              {nome && <InfoRow label="Nome" value={nome} />}
              <InfoRow label="Telefone" value={phone} />
              {email && <InfoRow label="Email" value={email} />}
              {documento && <InfoRow label="CNPJ/CPF" value={documento} />}
              {tipoCliente && (
                <InfoRow
                  label="Tipo de Cliente"
                  value={<Badge variant="outline" className="text-xs">{tipoCliente}</Badge>}
                />
              )}
              {vendedor?.nome && (
                <InfoRow
                  label="Vendedor"
                  value={
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {vendedor.nome}
                    </Badge>
                  }
                />
              )}
              {resolved?.statusLead && (
                <InfoRow
                  label="Status"
                  value={<Badge variant="secondary" className="text-xs">{resolved.statusLead}</Badge>}
                />
              )}
            </Section>

            {/* Shopify Orders list */}
            {pedidos.length > 0 && (
              <Section title={`Pedidos E-commerce (${pedidos.length})`} icon={<ShoppingCart className="h-4 w-4" />}>
                {pedidos.map((p: any) => (
                  <div key={p.id} className="border rounded p-2 space-y-1 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{p.order_number}</span>
                      <Badge variant={p.status_pagamento === "paid" ? "default" : "outline"} className="text-xs">
                        {p.status_pagamento}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>R$ {Number(p.valor_total).toFixed(2)}</span>
                      <span>{format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                    {(p.codigo_rastreio || p.codigo_rastreio_bling) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Truck className="h-3 w-3" />
                        <span className="font-mono">{p.codigo_rastreio || p.codigo_rastreio_bling}</span>
                      </div>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {/* Último Pedido Shopify (destaque) */}
            {pedidoShopify && (
              <Section title="Último Pedido E-commerce" icon={<ShoppingCart className="h-4 w-4" />}>
                <InfoRow label="Pedido" value={pedidoShopify.orderNumber} />
                <InfoRow
                  label="Valor"
                  value={pedidoShopify.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                />
                <InfoRow
                  label="Status"
                  value={
                    <Badge variant={pedidoShopify.statusPagamento === "paid" ? "default" : "outline"} className="text-xs">
                      {pedidoShopify.statusPagamento}
                    </Badge>
                  }
                />
                <InfoRow
                  label="Data"
                  value={format(new Date(pedidoShopify.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                />
                {pedidoShopify.urlRastreio && (
                  <InfoRow
                    label="Rastreio"
                    value={
                      <a
                        href={pedidoShopify.urlRastreio}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        Acompanhar <ExternalLink className="h-3 w-3" />
                      </a>
                    }
                  />
                )}
              </Section>
            )}

            {/* Access Data */}
            {cliente && (
              <Section title="Acesso Painel Gestão EBD" icon={<ShieldCheck className="h-4 w-4" />}>
                {cliente.email_superintendente && (
                  <InfoRow label="Email acesso" value={cliente.email_superintendente} />
                )}
                {resolved?.contaCriada !== null && (
                  <InfoRow label="Conta criada" value={resolved.contaCriada ? "Sim ✅" : "Não ❌"} />
                )}
                {cliente.senha_temporaria && (
                  <InfoRow label="Senha temporária" value={cliente.senha_temporaria} />
                )}
                <InfoRow label="Onboarding" value={cliente.onboarding_concluido ? "Concluído ✅" : "Pendente ⏳"} />
              </Section>
            )}

            {/* Last Login */}
            {ultimoLogin && (
              <Section title="Último Login" icon={<LogIn className="h-4 w-4" />}>
                <InfoRow
                  label="Último login"
                  value={format(new Date(ultimoLogin), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                />
              </Section>
            )}

            {/* Last Proposta */}
            {ultimoPedido && (
              <Section title="Última Proposta" icon={<Package className="h-4 w-4" />}>
                <InfoRow
                  label="Status"
                  value={<Badge variant="outline" className="text-xs">{ultimoPedido.status}</Badge>}
                />
                <InfoRow label="Valor" value={`R$ ${Number(ultimoPedido.valor_total).toFixed(2)}`} />
                <InfoRow
                  label="Data"
                  value={format(new Date(ultimoPedido.created_at), "dd/MM/yyyy", { locale: ptBR })}
                />
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3">
      <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2 text-foreground">
        {icon} {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{typeof value === "string" ? value : value}</span>
    </div>
  );
}
