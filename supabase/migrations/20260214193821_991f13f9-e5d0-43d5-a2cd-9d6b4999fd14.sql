
-- =============================================
-- Tabela: ebd_email_templates
-- =============================================
CREATE TABLE public.ebd_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  assunto text NOT NULL,
  corpo_html text NOT NULL,
  variaveis jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ebd_email_templates ENABLE ROW LEVEL SECURITY;

-- Templates são leitura pública (edge functions + vendedores)
CREATE POLICY "Templates EBD são visíveis para todos autenticados"
  ON public.ebd_email_templates FOR SELECT TO authenticated
  USING (true);

-- Apenas admins podem editar templates
CREATE POLICY "Admins podem gerenciar templates EBD"
  ON public.ebd_email_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_ebd_email_templates_updated_at
  BEFORE UPDATE ON public.ebd_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Tabela: ebd_email_logs
-- =============================================
CREATE TABLE public.ebd_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.ebd_email_templates(id),
  cliente_id uuid REFERENCES public.ebd_clientes(id),
  vendedor_id uuid REFERENCES public.vendedores(id),
  destinatario text NOT NULL,
  assunto text,
  status text NOT NULL DEFAULT 'enviado',
  erro text,
  dados_enviados jsonb DEFAULT '{}'::jsonb,
  tipo_envio text DEFAULT 'manual',
  resend_email_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ebd_email_logs ENABLE ROW LEVEL SECURITY;

-- Vendedores veem apenas seus próprios logs
CREATE POLICY "Vendedores veem seus próprios logs de email EBD"
  ON public.ebd_email_logs FOR SELECT TO authenticated
  USING (
    vendedor_id = (SELECT id FROM public.vendedores WHERE email = public.get_auth_email() LIMIT 1)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente_ebd')
  );

-- Inserção via service role (edge function) - sem restrição para insert
CREATE POLICY "Service pode inserir logs de email EBD"
  ON public.ebd_email_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_ebd_email_logs_cliente_id ON public.ebd_email_logs(cliente_id);
CREATE INDEX idx_ebd_email_logs_vendedor_id ON public.ebd_email_logs(vendedor_id);
CREATE INDEX idx_ebd_email_logs_template_id ON public.ebd_email_logs(template_id);
CREATE INDEX idx_ebd_email_logs_created_at ON public.ebd_email_logs(created_at DESC);
CREATE INDEX idx_ebd_email_logs_tipo_envio ON public.ebd_email_logs(tipo_envio);

-- =============================================
-- SEED: 8 Templates de Email EBD
-- =============================================

INSERT INTO public.ebd_email_templates (codigo, nome, descricao, assunto, corpo_html, variaveis) VALUES

-- 1. Reposição 14 dias
('ebd_reposicao_14d', 'Alerta de Reposição (14 dias)', 'Enviado 14 dias antes da data prevista de próxima compra', 
'📚 Suas revistas estão acabando - Hora de repor!',
'<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="background-color:#1a1a2e;padding:24px;text-align:center"><img src="https://gestaoebd.lovable.app/lovable-uploads/94e6b7e9-e845-47c8-bf31-1d80ecb4ed92.png" alt="Central Gospel" width="180" style="max-width:180px"><p style="color:#B8860B;font-size:14px;margin:8px 0 0;font-weight:bold">Escola Bíblica Dominical</p></td></tr><tr><td style="padding:32px 24px"><h1 style="color:#1a1a2e;font-size:22px;margin:0 0 16px">Olá, {nome}! 👋</h1><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">Faltam <strong style="color:#B8860B">14 dias</strong> para a data prevista de reposição das revistas da <strong>{nome_igreja}</strong>.</p><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px">Garanta que seus alunos tenham o material em mãos! Faça seu pedido com antecedência e evite ficar sem revistas.</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff8e1;border-left:4px solid #B8860B;padding:16px;border-radius:4px;margin-bottom:24px"><tr><td><p style="margin:0;color:#333;font-size:14px"><strong>📅 Data prevista:</strong> {data_proxima_compra}</p><p style="margin:8px 0 0;color:#333;font-size:14px"><strong>⛪ Igreja:</strong> {nome_igreja}</p></td></tr></table><div style="text-align:center;margin:24px 0"><a href="{link_catalogo}" style="background-color:#B8860B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block">Ver Catálogo de Revistas</a></div><p style="color:#888;font-size:14px;line-height:1.5;margin:24px 0 0">Seu vendedor <strong>{vendedor_nome}</strong> está à disposição para ajudá-lo com o pedido.</p></td></tr><tr><td style="background-color:#1a1a2e;padding:20px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Central Gospel Editora © 2025</p><p style="color:#666;font-size:11px;margin:4px 0 0">Este email foi enviado automaticamente pelo Painel EBD</p></td></tr></table></td></tr></table></body></html>',
'["nome", "nome_igreja", "data_proxima_compra", "link_catalogo", "vendedor_nome"]'::jsonb),

-- 2. Reposição 7 dias
('ebd_reposicao_7d', 'Alerta de Reposição (7 dias)', 'Enviado 7 dias antes da data prevista de próxima compra',
'⚠️ Últimos dias! Reponha suas revistas EBD',
'<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="background-color:#1a1a2e;padding:24px;text-align:center"><img src="https://gestaoebd.lovable.app/lovable-uploads/94e6b7e9-e845-47c8-bf31-1d80ecb4ed92.png" alt="Central Gospel" width="180" style="max-width:180px"><p style="color:#B8860B;font-size:14px;margin:8px 0 0;font-weight:bold">Escola Bíblica Dominical</p></td></tr><tr><td style="padding:32px 24px"><h1 style="color:#1a1a2e;font-size:22px;margin:0 0 16px">⚠️ Atenção, {nome}!</h1><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">Faltam apenas <strong style="color:#cc0000">7 dias</strong> para a data prevista de reposição das revistas da <strong>{nome_igreja}</strong>.</p><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px">Não deixe para a última hora! Faça seu pedido agora e garanta a entrega a tempo.</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffebee;border-left:4px solid #cc0000;padding:16px;border-radius:4px;margin-bottom:24px"><tr><td><p style="margin:0;color:#333;font-size:14px"><strong>📅 Data prevista:</strong> {data_proxima_compra}</p><p style="margin:8px 0 0;color:#333;font-size:14px"><strong>⛪ Igreja:</strong> {nome_igreja}</p><p style="margin:8px 0 0;color:#cc0000;font-size:14px;font-weight:bold">⏰ Urgente - apenas 7 dias!</p></td></tr></table><div style="text-align:center;margin:24px 0"><a href="{link_catalogo}" style="background-color:#cc0000;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block">Fazer Pedido Agora</a></div><p style="color:#888;font-size:14px;line-height:1.5;margin:24px 0 0">Entre em contato com <strong>{vendedor_nome}</strong> para agilizar seu pedido.</p></td></tr><tr><td style="background-color:#1a1a2e;padding:20px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Central Gospel Editora © 2025</p><p style="color:#666;font-size:11px;margin:4px 0 0">Este email foi enviado automaticamente pelo Painel EBD</p></td></tr></table></td></tr></table></body></html>',
'["nome", "nome_igreja", "data_proxima_compra", "link_catalogo", "vendedor_nome"]'::jsonb),

-- 3. Reposição hoje
('ebd_reposicao_hoje', 'Alerta de Reposição (no dia)', 'Enviado no dia da data prevista de próxima compra',
'🔔 Hoje é o dia! Garanta suas revistas EBD',
'<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="background-color:#1a1a2e;padding:24px;text-align:center"><img src="https://gestaoebd.lovable.app/lovable-uploads/94e6b7e9-e845-47c8-bf31-1d80ecb4ed92.png" alt="Central Gospel" width="180" style="max-width:180px"><p style="color:#B8860B;font-size:14px;margin:8px 0 0;font-weight:bold">Escola Bíblica Dominical</p></td></tr><tr><td style="padding:32px 24px"><h1 style="color:#cc0000;font-size:22px;margin:0 0 16px">🔔 Hoje é o dia, {nome}!</h1><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">A data prevista de reposição das revistas da <strong>{nome_igreja}</strong> é <strong style="color:#cc0000">HOJE</strong>.</p><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px">Se ainda não fez o pedido, entre em contato com seu vendedor imediatamente para garantir que seus alunos não fiquem sem material.</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffebee;border-left:4px solid #cc0000;padding:16px;border-radius:4px;margin-bottom:24px"><tr><td><p style="margin:0;color:#cc0000;font-size:16px;font-weight:bold">⚠️ Data de reposição: HOJE ({data_proxima_compra})</p><p style="margin:8px 0 0;color:#333;font-size:14px"><strong>⛪ Igreja:</strong> {nome_igreja}</p></td></tr></table><div style="text-align:center;margin:24px 0"><a href="{link_catalogo}" style="background-color:#cc0000;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block">Fazer Pedido Urgente</a></div><p style="color:#888;font-size:14px;line-height:1.5;margin:24px 0 0">Fale agora com <strong>{vendedor_nome}</strong> pelo WhatsApp ou telefone.</p></td></tr><tr><td style="background-color:#1a1a2e;padding:20px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Central Gospel Editora © 2025</p><p style="color:#666;font-size:11px;margin:4px 0 0">Este email foi enviado automaticamente pelo Painel EBD</p></td></tr></table></td></tr></table></body></html>',
'["nome", "nome_igreja", "data_proxima_compra", "link_catalogo", "vendedor_nome"]'::jsonb),

-- 4. Boas-vindas pós-compra
('ebd_boas_vindas', 'Pós-Compra / Boas-vindas', 'Enviado após compra e-commerce para clientes novos',
'🎉 Bem-vindo à Central Gospel! Ative seu painel gratuito',
'<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="background-color:#1a1a2e;padding:24px;text-align:center"><img src="https://gestaoebd.lovable.app/lovable-uploads/94e6b7e9-e845-47c8-bf31-1d80ecb4ed92.png" alt="Central Gospel" width="180" style="max-width:180px"><p style="color:#B8860B;font-size:14px;margin:8px 0 0;font-weight:bold">Escola Bíblica Dominical</p></td></tr><tr><td style="padding:32px 24px"><h1 style="color:#1a1a2e;font-size:22px;margin:0 0 16px">Bem-vindo, {nome}! 🎉</h1><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">Obrigado por adquirir as revistas EBD para a <strong>{nome_igreja}</strong>! Sua compra foi recebida com sucesso.</p><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px">Você sabia que tem acesso <strong style="color:#B8860B">GRATUITO</strong> ao Painel de Gestão EBD? Nele você pode:</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="padding:8px 0;color:#555;font-size:15px">✅ Controlar frequência dos alunos</td></tr><tr><td style="padding:8px 0;color:#555;font-size:15px">✅ Gerenciar turmas e professores</td></tr><tr><td style="padding:8px 0;color:#555;font-size:15px">✅ Acessar planos de leitura bíblica</td></tr><tr><td style="padding:8px 0;color:#555;font-size:15px">✅ Acompanhar relatórios completos</td></tr></table><div style="text-align:center;margin:24px 0"><a href="{link_painel}" style="background-color:#B8860B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block">Ativar Meu Painel Gratuito</a></div><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;border-left:4px solid #2196F3;padding:16px;border-radius:4px;margin:24px 0"><tr><td><p style="margin:0;color:#333;font-size:14px"><strong>Seu vendedor dedicado:</strong></p><p style="margin:4px 0;color:#555;font-size:14px">👤 {vendedor_nome}</p><p style="margin:4px 0;color:#555;font-size:14px">📱 {vendedor_telefone}</p><p style="margin:4px 0;color:#888;font-size:13px">Qualquer dúvida, entre em contato!</p></td></tr></table></td></tr><tr><td style="background-color:#1a1a2e;padding:20px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Central Gospel Editora © 2025</p><p style="color:#666;font-size:11px;margin:4px 0 0">Este email foi enviado automaticamente pelo Painel EBD</p></td></tr></table></td></tr></table></body></html>',
'["nome", "nome_igreja", "vendedor_nome", "vendedor_telefone", "link_painel"]'::jsonb),

-- 5. Ativação 3 dias
('ebd_ativacao_3d', 'Lembrete Ativação (3 dias)', 'Enviado 3 dias após cadastro se painel não foi ativado',
'📋 Você ainda não ativou seu Painel EBD!',
'<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="background-color:#1a1a2e;padding:24px;text-align:center"><img src="https://gestaoebd.lovable.app/lovable-uploads/94e6b7e9-e845-47c8-bf31-1d80ecb4ed92.png" alt="Central Gospel" width="180" style="max-width:180px"><p style="color:#B8860B;font-size:14px;margin:8px 0 0;font-weight:bold">Escola Bíblica Dominical</p></td></tr><tr><td style="padding:32px 24px"><h1 style="color:#1a1a2e;font-size:22px;margin:0 0 16px">Olá, {nome}! 👋</h1><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">Notamos que você ainda <strong>não ativou</strong> o Painel de Gestão EBD da <strong>{nome_igreja}</strong>.</p><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px">O painel é <strong style="color:#B8860B">100% gratuito</strong> e vai transformar a gestão da sua Escola Bíblica Dominical. Leva menos de 2 minutos para ativar!</p><div style="text-align:center;margin:24px 0"><a href="{link_painel}" style="background-color:#B8860B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block">Ativar Agora (2 min)</a></div><p style="color:#888;font-size:14px;line-height:1.5;margin:24px 0 0">Se precisar de ajuda, fale com <strong>{vendedor_nome}</strong>.</p></td></tr><tr><td style="background-color:#1a1a2e;padding:20px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Central Gospel Editora © 2025</p><p style="color:#666;font-size:11px;margin:4px 0 0">Este email foi enviado automaticamente pelo Painel EBD</p></td></tr></table></td></tr></table></body></html>',
'["nome", "nome_igreja", "link_painel", "vendedor_nome"]'::jsonb),

-- 6. Ativação 7 dias
('ebd_ativacao_7d', 'Lembrete Ativação (7 dias)', 'Enviado 7 dias após cadastro se painel não foi ativado - tom mais urgente',
'⏰ Última chamada! Seu Painel EBD está esperando',
'<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="background-color:#1a1a2e;padding:24px;text-align:center"><img src="https://gestaoebd.lovable.app/lovable-uploads/94e6b7e9-e845-47c8-bf31-1d80ecb4ed92.png" alt="Central Gospel" width="180" style="max-width:180px"><p style="color:#B8860B;font-size:14px;margin:8px 0 0;font-weight:bold">Escola Bíblica Dominical</p></td></tr><tr><td style="padding:32px 24px"><h1 style="color:#1a1a2e;font-size:22px;margin:0 0 16px">⏰ Não perca essa oportunidade, {nome}!</h1><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">Já se passaram <strong style="color:#cc0000">7 dias</strong> e o Painel EBD da <strong>{nome_igreja}</strong> ainda não foi ativado.</p><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">Outras igrejas já estão usando o painel para:</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="padding:6px 0;color:#555;font-size:15px">📊 Acompanhar a frequência em tempo real</td></tr><tr><td style="padding:6px 0;color:#555;font-size:15px">🏆 Engajar alunos com gamificação</td></tr><tr><td style="padding:6px 0;color:#555;font-size:15px">📖 Organizar planos de leitura bíblica</td></tr></table><div style="text-align:center;margin:24px 0"><a href="{link_painel}" style="background-color:#B8860B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block">Ativar Meu Painel Gratuito</a></div><p style="color:#888;font-size:14px;line-height:1.5;margin:24px 0 0">Precisa de ajuda? <strong>{vendedor_nome}</strong> pode ativar para você!</p></td></tr><tr><td style="background-color:#1a1a2e;padding:20px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Central Gospel Editora © 2025</p><p style="color:#666;font-size:11px;margin:4px 0 0">Este email foi enviado automaticamente pelo Painel EBD</p></td></tr></table></td></tr></table></body></html>',
'["nome", "nome_igreja", "link_painel", "vendedor_nome"]'::jsonb),

-- 7. Cliente inativo
('ebd_cliente_inativo', 'Re-engajamento (30+ dias)', 'Enviado quando cliente não faz login há mais de 30 dias',
'😢 Sentimos sua falta na EBD!',
'<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="background-color:#1a1a2e;padding:24px;text-align:center"><img src="https://gestaoebd.lovable.app/lovable-uploads/94e6b7e9-e845-47c8-bf31-1d80ecb4ed92.png" alt="Central Gospel" width="180" style="max-width:180px"><p style="color:#B8860B;font-size:14px;margin:8px 0 0;font-weight:bold">Escola Bíblica Dominical</p></td></tr><tr><td style="padding:32px 24px"><h1 style="color:#1a1a2e;font-size:22px;margin:0 0 16px">Sentimos sua falta, {nome}! 😢</h1><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">Faz <strong style="color:#B8860B">{dias_sem_login} dias</strong> que você não acessa o Painel EBD da <strong>{nome_igreja}</strong>.</p><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px">Muitas novidades foram adicionadas! Volte e confira tudo o que preparamos para sua escola bíblica.</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff8e1;border-left:4px solid #B8860B;padding:16px;border-radius:4px;margin-bottom:24px"><tr><td><p style="margin:0;color:#333;font-size:14px"><strong>O que você está perdendo:</strong></p><p style="margin:8px 0 0;color:#555;font-size:14px">🆕 Novas funcionalidades no painel</p><p style="margin:4px 0 0;color:#555;font-size:14px">📊 Relatórios atualizados da sua EBD</p><p style="margin:4px 0 0;color:#555;font-size:14px">📖 Novos planos de leitura disponíveis</p></td></tr></table><div style="text-align:center;margin:24px 0"><a href="{link_painel}" style="background-color:#B8860B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block">Voltar ao Painel EBD</a></div><p style="color:#888;font-size:14px;line-height:1.5;margin:24px 0 0">Precisa de suporte? <strong>{vendedor_nome}</strong> está à disposição.</p></td></tr><tr><td style="background-color:#1a1a2e;padding:20px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Central Gospel Editora © 2025</p><p style="color:#666;font-size:11px;margin:4px 0 0">Este email foi enviado automaticamente pelo Painel EBD</p></td></tr></table></td></tr></table></body></html>',
'["nome", "nome_igreja", "dias_sem_login", "link_painel", "vendedor_nome"]'::jsonb),

-- 8. Novo trimestre
('ebd_novo_trimestre', 'Lançamento Novo Trimestre', 'Enviado no início de cada trimestre (Jan, Abr, Jul, Out)',
'📖 Novas revistas EBD disponíveis - Trimestre {trimestre}',
'<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="background-color:#1a1a2e;padding:24px;text-align:center"><img src="https://gestaoebd.lovable.app/lovable-uploads/94e6b7e9-e845-47c8-bf31-1d80ecb4ed92.png" alt="Central Gospel" width="180" style="max-width:180px"><p style="color:#B8860B;font-size:14px;margin:8px 0 0;font-weight:bold">Escola Bíblica Dominical</p></td></tr><tr><td style="padding:32px 24px"><h1 style="color:#1a1a2e;font-size:22px;margin:0 0 16px">🆕 Novo Trimestre, {nome}!</h1><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 16px">As revistas do <strong style="color:#B8860B">Trimestre {trimestre}</strong> já estão disponíveis para a <strong>{nome_igreja}</strong>!</p><p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px">Faça seu pedido agora e garanta o material com antecedência para seus alunos e professores.</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8f5e9;border-left:4px solid #4CAF50;padding:16px;border-radius:4px;margin-bottom:24px"><tr><td><p style="margin:0;color:#333;font-size:14px"><strong>📦 Trimestre:</strong> {trimestre}</p><p style="margin:8px 0 0;color:#333;font-size:14px"><strong>⛪ Igreja:</strong> {nome_igreja}</p><p style="margin:8px 0 0;color:#4CAF50;font-size:14px;font-weight:bold">✨ Novos conteúdos e lições!</p></td></tr></table><div style="text-align:center;margin:24px 0"><a href="{link_catalogo}" style="background-color:#B8860B;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block">Ver Revistas do Trimestre</a></div><p style="color:#888;font-size:14px;line-height:1.5;margin:24px 0 0">Fale com <strong>{vendedor_nome}</strong> para condições especiais de compra antecipada.</p></td></tr><tr><td style="background-color:#1a1a2e;padding:20px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Central Gospel Editora © 2025</p><p style="color:#666;font-size:11px;margin:4px 0 0">Este email foi enviado automaticamente pelo Painel EBD</p></td></tr></table></td></tr></table></body></html>',
'["nome", "nome_igreja", "trimestre", "link_catalogo", "vendedor_nome"]'::jsonb);
