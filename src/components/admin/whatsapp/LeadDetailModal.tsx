import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Phone, Mail, Building, ShieldCheck, ShoppingCart, LogIn } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
      // 1. Lead from ebd_leads_reativacao
      const { data: leads } = await supabase
        .from("ebd_leads_reativacao")
        .select("*, vendedores(nome)")
        .eq("telefone", phone)
        .limit(1);

      const lead = leads?.[0] || null;

      // 2. Client from ebd_clientes (match by phone)
      const { data: clientes } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, email_superintendente, telefone, tipo_cliente, cnpj, cpf, senha_temporaria, ultimo_login, onboarding_concluido, data_proxima_compra")
        .eq("telefone", phone)
        .limit(1);

      const cliente = clientes?.[0] || null;

      // 3. Last order (vendedor_propostas) if we have a cliente_id
      let ultimoPedido = null;
      const clienteId = lead?.id && cliente?.id ? cliente.id : (cliente?.id || null);
      if (clienteId) {
        const { data: propostas } = await supabase
          .from("vendedor_propostas")
          .select("id, status, valor_total, created_at, cliente_nome")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(1);
        ultimoPedido = propostas?.[0] || null;
      }

      return { lead, cliente, ultimoPedido };
    },
  });

  const lead = data?.lead;
  const cliente = data?.cliente;
  const ultimoPedido = data?.ultimoPedido;
  const vendedorNome = (lead?.vendedores as any)?.nome || null;

  const tipoCliente = lead?.tipo_lead || cliente?.tipo_cliente || "—";
  const nome = lead?.nome_igreja || cliente?.nome_igreja || "—";
  const email = lead?.email || cliente?.email_superintendente || "—";
  const cnpjCpf = lead?.cnpj || cliente?.cnpj || cliente?.cpf || "—";
  const ultimoLogin = lead?.ultimo_login_ebd || cliente?.ultimo_login || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
        ) : !lead && !cliente ? (
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

            {/* Last Order */}
            <Section title="Último Pedido" icon={<ShoppingCart className="h-4 w-4" />}>
              {ultimoPedido ? (
                <>
                  <InfoRow label="Status" value={
                    <Badge variant="outline" className="text-xs">{ultimoPedido.status}</Badge>
                  } />
                  <InfoRow label="Valor" value={`R$ ${Number(ultimoPedido.valor_total).toFixed(2)}`} />
                  <InfoRow label="Data" value={format(new Date(ultimoPedido.created_at), "dd/MM/yyyy", { locale: ptBR })} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
              )}
            </Section>
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
