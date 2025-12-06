-- Add responsible configuration fields to ebd_turmas table
ALTER TABLE public.ebd_turmas
ADD COLUMN responsavel_chamada text NOT NULL DEFAULT 'Professor',
ADD COLUMN responsavel_dados_aula text NOT NULL DEFAULT 'Professor',
ADD COLUMN responsavel_pontuacao text NOT NULL DEFAULT 'Professor';

-- Add check constraints to ensure valid values
ALTER TABLE public.ebd_turmas
ADD CONSTRAINT check_responsavel_chamada CHECK (responsavel_chamada IN ('Secretario', 'Professor', 'Aluno')),
ADD CONSTRAINT check_responsavel_dados_aula CHECK (responsavel_dados_aula IN ('Secretario', 'Professor')),
ADD CONSTRAINT check_responsavel_pontuacao CHECK (responsavel_pontuacao IN ('Professor'));

-- Add comments for documentation
COMMENT ON COLUMN public.ebd_turmas.responsavel_chamada IS 'Define quem é responsável por registrar a presença: Secretario, Professor ou Aluno';
COMMENT ON COLUMN public.ebd_turmas.responsavel_dados_aula IS 'Define quem é responsável por registrar ofertas, visitantes, bíblias, revistas: Secretario ou Professor';
COMMENT ON COLUMN public.ebd_turmas.responsavel_pontuacao IS 'Define quem é responsável por registrar pontuação: Professor';