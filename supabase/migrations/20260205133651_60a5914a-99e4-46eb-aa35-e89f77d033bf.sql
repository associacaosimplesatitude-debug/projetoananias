-- Adicionar campo polo na tabela vendedores
ALTER TABLE public.vendedores ADD COLUMN polo TEXT NULL;

-- Atualizar vendedores da Loja Penha
UPDATE public.vendedores 
SET polo = 'penha' 
WHERE email IN ('glorinha21carreiro@gmail.com', 'antonio.goulart@editoracentralgospel.com');