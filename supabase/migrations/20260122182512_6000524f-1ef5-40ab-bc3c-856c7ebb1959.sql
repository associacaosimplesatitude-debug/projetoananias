-- Política RLS para permitir leitura pública de dados básicos da igreja ativa
CREATE POLICY "allow_public_read_basic_church_info" 
ON public.ebd_clientes 
FOR SELECT 
USING (status_ativacao_ebd = true);

-- Política RLS para permitir leitura pública de turmas ativas
CREATE POLICY "allow_public_read_active_turmas" 
ON public.ebd_turmas 
FOR SELECT 
USING (is_active = true);

-- Política RLS para permitir inserção pública de alunos (será controlada pela edge function)
CREATE POLICY "allow_public_insert_alunos" 
ON public.ebd_alunos 
FOR INSERT 
WITH CHECK (true);