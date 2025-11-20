
-- Adicionar campo de email na tabela church_members
ALTER TABLE church_members 
ADD COLUMN IF NOT EXISTS email text;

-- Criar índice para busca por email
CREATE INDEX IF NOT EXISTS idx_church_members_email ON church_members(email);

-- Adicionar comentário explicativo
COMMENT ON COLUMN church_members.email IS 'Email do membro usado para login no sistema';
