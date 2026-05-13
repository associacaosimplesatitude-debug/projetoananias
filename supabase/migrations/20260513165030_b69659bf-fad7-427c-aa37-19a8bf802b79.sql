-- Recria policy de leitura "vendedor lê conversas dos clientes dele" sem subquery em auth.users.
-- A versão antiga acessava auth.users diretamente, o que dispara permission denied
-- para o role 'authenticated' e faz o PostgREST devolver 403 em todo o SELECT
-- da tabela agente_ia_conversas.

DROP POLICY IF EXISTS vendedor_le_conversas_seus_clientes ON public.agente_ia_conversas;

CREATE POLICY vendedor_le_conversas_seus_clientes
ON public.agente_ia_conversas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  cliente_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.ebd_clientes c
    WHERE c.id = agente_ia_conversas.cliente_id
      AND c.vendedor_id = public.current_vendedor_id()
  )
);

NOTIFY pgrst, 'reload schema';