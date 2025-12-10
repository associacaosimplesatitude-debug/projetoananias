-- Create table for lead reactivation (churn leads)
CREATE TABLE public.ebd_leads_reativacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID REFERENCES public.vendedores(id),
  status_lead TEXT NOT NULL DEFAULT 'Não Contatado',
  motivo_perda TEXT,
  data_followup DATE,
  email_aberto BOOLEAN NOT NULL DEFAULT false,
  ultimo_login_ebd TIMESTAMP WITH TIME ZONE,
  lead_score TEXT NOT NULL DEFAULT 'Frio',
  
  -- Dados do cliente/igreja
  nome_igreja TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  email_nota TEXT,
  telefone TEXT,
  nome_responsavel TEXT,
  
  -- Endereço
  endereco_cep TEXT,
  endereco_rua TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_estado TEXT,
  
  -- Dados EBD
  ultima_compra DATE,
  valor_ultima_compra NUMERIC,
  total_compras_historico NUMERIC,
  
  -- Observações
  observacoes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ebd_leads_reativacao ENABLE ROW LEVEL SECURITY;

-- Admin can manage all leads
CREATE POLICY "Admins can manage all leads"
ON public.ebd_leads_reativacao
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Vendedores can view their assigned leads
CREATE POLICY "Vendedores can view their assigned leads"
ON public.ebd_leads_reativacao
FOR SELECT
USING (vendedor_id = get_vendedor_id_by_email(get_auth_email()));

-- Vendedores can update their assigned leads
CREATE POLICY "Vendedores can update their assigned leads"
ON public.ebd_leads_reativacao
FOR UPDATE
USING (vendedor_id = get_vendedor_id_by_email(get_auth_email()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ebd_leads_reativacao_updated_at
BEFORE UPDATE ON public.ebd_leads_reativacao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_ebd_leads_reativacao_vendedor ON public.ebd_leads_reativacao(vendedor_id);
CREATE INDEX idx_ebd_leads_reativacao_status ON public.ebd_leads_reativacao(status_lead);
CREATE INDEX idx_ebd_leads_reativacao_score ON public.ebd_leads_reativacao(lead_score);