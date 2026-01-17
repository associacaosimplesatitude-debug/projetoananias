-- Limpar todas as comissões existentes para começar do zero
DELETE FROM vendedor_propostas_parcelas;

-- Adicionar coluna de controle na tabela de propostas
ALTER TABLE vendedor_propostas 
ADD COLUMN IF NOT EXISTS comissao_aprovada boolean DEFAULT false;