-- Fase 9: Sistema de Auditoria para Royalties

-- Criar função de trigger para auditoria
CREATE OR REPLACE FUNCTION public.royalties_audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.royalties_audit_logs 
      (user_id, acao, tabela, registro_id, dados_antigos, dados_novos)
    VALUES 
      (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.royalties_audit_logs 
      (user_id, acao, tabela, registro_id, dados_antigos, dados_novos)
    VALUES 
      (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.royalties_audit_logs 
      (user_id, acao, tabela, registro_id, dados_antigos, dados_novos)
    VALUES 
      (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Criar triggers para cada tabela do módulo Royalties

-- Trigger para royalties_autores
CREATE TRIGGER audit_royalties_autores
  AFTER INSERT OR UPDATE OR DELETE ON public.royalties_autores
  FOR EACH ROW EXECUTE FUNCTION public.royalties_audit_trigger_fn();

-- Trigger para royalties_livros
CREATE TRIGGER audit_royalties_livros
  AFTER INSERT OR UPDATE OR DELETE ON public.royalties_livros
  FOR EACH ROW EXECUTE FUNCTION public.royalties_audit_trigger_fn();

-- Trigger para royalties_comissoes
CREATE TRIGGER audit_royalties_comissoes
  AFTER INSERT OR UPDATE OR DELETE ON public.royalties_comissoes
  FOR EACH ROW EXECUTE FUNCTION public.royalties_audit_trigger_fn();

-- Trigger para royalties_vendas
CREATE TRIGGER audit_royalties_vendas
  AFTER INSERT OR UPDATE OR DELETE ON public.royalties_vendas
  FOR EACH ROW EXECUTE FUNCTION public.royalties_audit_trigger_fn();

-- Trigger para royalties_pagamentos
CREATE TRIGGER audit_royalties_pagamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.royalties_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.royalties_audit_trigger_fn();