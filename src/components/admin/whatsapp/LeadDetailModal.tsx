import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Phone, Mail, Building, ShieldCheck, ShoppingCart, LogIn, Package, Truck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Normalize phone: strip non-digits, remove leading "55" country code
// Also generates variants to handle the Brazilian 9th digit issue
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

// Generate phone variants for matching (with and without 9th digit)
function phoneVariants(phone: string): string[] {
  const base = normalizePhone(phone);
  const variants = [base];
  // If 10 digits (DDD + 8 number), add variant with 9: DDD + 9 + number
  if (base.length === 10) {
    variants.push(base.slice(0, 2) + "9" + base.slice(2));
  }
  // If 11 digits (DDD + 9 + 8 number), add variant without 9
  if (base.length === 11 && base[2] === "9") {
    variants.push(base.slice(0, 2) + base.slice(3));
  }
  return variants;
}

function phonesMatch(phone1: string, phone2: string): boolean {
  const v1 = phoneVariants(phone1);
  const v2 = phoneVariants(phone2);
  return v1.some(a => v2.some(b => a === b));
}

interface LeadDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
}

export default function LeadDetailModal({ open, onOpenChange, phone }: LeadDetailModalProps) {
  // Fetch lead data
  const { data, isLoading } = useQuery({
    queryKey: ["lead-detail", phone],
    enabled: open && !!phone,
    queryFn: async () => {
      // 1. Get all leads, then filter by normalized phone
      const { data: allLeads } = await supabase
        .from("ebd_leads_reativacao")
        .select("*, vendedores(nome)")
        .not("telefone", "is", null);

      const lead = (allLeads || []).find(
        (l: any) => l.telefone && phonesMatch(l.telefone, phone)
      ) || null;

      // 2. Get all clients, then filter by normalized phone
      const { data: allClientes } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, email_superintendente, telefone, tipo_cliente, cnpj, cpf, senha_temporaria, ultimo_login, onboarding_concluido, data_proxima_compra")
        .not("telefone", "is", null);

      const cliente = (allClientes || []).find(
        (c: any) => c.telefone && phonesMatch(c.telefone, phone)
      ) || null;

      // 3. Shopify orders - search by customer_phone
      const { data: allPedidos } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, order_number, customer_name, customer_email, customer_phone, customer_document, valor_total, valor_frete, status_pagamento, created_at, codigo_rastreio, codigo_rastreio_bling, url_rastreio, vendedor_id")
        .not("customer_phone", "is", null);

      const pedidos = (allPedidos || []).filter(
        (p: any) => p.customer_phone && phonesMatch(p.customer_phone, phone)
      ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // 4. Last order (vendedor_propostas) if we have a cliente_id
      let ultimoPedido = null;
      const clienteId = cliente?.id || null;
      if (clienteId) {
        const { data: propostas } = await supabase
          .from("vendedor_propostas")
          .select("id, status, valor_total, created_at, cliente_nome")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(1);
        ultimoPedido = propostas?.[0] || null;
      }

      // Get vendedor name for shopify orders
      let vendedorNomeShopify: string | null = null;
      if (pedidos.length > 0 && pedidos[0].vendedor_id) {
        const { data: vend } = await supabase
          .from("vendedores")
          .select("nome")
          .eq("id", pedidos[0].vendedor_id)
          .maybeSingle();
        vendedorNomeShopify = vend?.nome || null;
      }

      return { lead, cliente, ultimoPedido, pedidos, vendedorNomeShopify };
    },
  });

  const lead = data?.lead;
  const cliente = data?.cliente;
  const ultimoPedido = data?.ultimoPedido;
  const pedidos = data?.pedidos || [];
  const vendedorNomeShopify = data?.vendedorNomeShopify;
  const vendedorNome = (lead?.vendedores as any)?.nome || vendedorNomeShopify || null;

  // Merge info from all sources
  const shopifyOrder = pedidos[0] || null;
  const tipoCliente = lead?.tipo_lead || cliente?.tipo_cliente || "—";
  const nome = lead?.nome_igreja || cliente?.nome_igreja || shopifyOrder?.customer_name || "—";
  const email = lead?.email || cliente?.email_superintendente || shopifyOrder?.customer_email || "—";
  const cnpjCpf = lead?.cnpj || cliente?.cnpj || cliente?.cpf || shopifyOrder?.customer_document || "—";
  const ultimoLogin = lead?.ultimo_login_ebd || cliente?.ultimo_login || null;

  const hasAnyData = lead || cliente || pedidos.length > 0;

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
            {/* Basic Info */}
            <Section title="Informações Gerais" icon={<Building className="h-4 w-4" />}>
              <InfoRow label="Nome" value={nome} />
              <InfoRow label="Telefone" value={phone} />
              <InfoRow label="Email" value={email} />
              <InfoRow label="CNPJ/CPF" value={cnpjCpf} />
              <InfoRow label="Tipo de Cliente" value={
                <Badge variant="outline" className="text-xs">{tipoCliente}</Badge>
              } />
              {vendedorNome && (
                <InfoRow label="Vendedor" value={
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{vendedorNome}</Badge>
                } />
              )}
              {lead?.status_lead && (
                <InfoRow label="Status" value={
                  <Badge variant="secondary" className="text-xs">{lead.status_lead}</Badge>
                } />
              )}
            </Section>

            {/* Shopify Orders */}
            {pedidos.length > 0 && (
              <Section title={`Pedidos Shopify (${pedidos.length})`} icon={<ShoppingCart className="h-4 w-4" />}>
                {pedidos.map((p: any) => (
                  <div key={p.id} className="border rounded p-2 space-y-1 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{p.order_number}</span>
                      <Badge variant={p.status_pagamento === 'paid' ? 'default' : 'outline'} className="text-xs">
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

            {/* Access Data */}
            <Section title="Acesso Painel Gestão EBD" icon={<ShieldCheck className="h-4 w-4" />}>
              {cliente ? (
                <>
                  <InfoRow label="Email acesso" value={cliente.email_superintendente || "—"} />
                  <InfoRow label="Conta criada" value={lead?.conta_criada ? "Sim ✅" : "Não ❌"} />
                  <InfoRow label="Senha temporária" value={cliente.senha_temporaria || "—"} />
                  <InfoRow label="Onboarding" value={cliente.onboarding_concluido ? "Concluído ✅" : "Pendente ⏳"} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados de acesso vinculados.</p>
              )}
            </Section>

            {/* Last Login */}
            <Section title="Último Login" icon={<LogIn className="h-4 w-4" />}>
              <InfoRow label="Último login" value={
                ultimoLogin
                  ? format(new Date(ultimoLogin), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : "Nunca acessou"
              } />
            </Section>

            {/* Last Proposta */}
            {ultimoPedido && (
              <Section title="Última Proposta" icon={<Package className="h-4 w-4" />}>
                <InfoRow label="Status" value={
                  <Badge variant="outline" className="text-xs">{ultimoPedido.status}</Badge>
                } />
                <InfoRow label="Valor" value={`R$ ${Number(ultimoPedido.valor_total).toFixed(2)}`} />
                <InfoRow label="Data" value={format(new Date(ultimoPedido.created_at), "dd/MM/yyyy", { locale: ptBR })} />
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
