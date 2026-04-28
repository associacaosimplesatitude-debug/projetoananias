-- 1. Trigger function to keep revista_licencas.quantidade_usada in sync
CREATE OR REPLACE FUNCTION public.sync_revista_licenca_pool()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.revista_licencas
       SET quantidade_usada = quantidade_usada + 1,
           updated_at = now()
     WHERE id = NEW.licenca_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.revista_licencas
       SET quantidade_usada = GREATEST(quantidade_usada - 1, 0),
           updated_at = now()
     WHERE id = OLD.licenca_id;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.licenca_id IS DISTINCT FROM NEW.licenca_id THEN
      UPDATE public.revista_licencas
         SET quantidade_usada = GREATEST(quantidade_usada - 1, 0),
             updated_at = now()
       WHERE id = OLD.licenca_id;
      UPDATE public.revista_licencas
         SET quantidade_usada = quantidade_usada + 1,
             updated_at = now()
       WHERE id = NEW.licenca_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_revista_licenca_pool_ins ON public.revista_licenca_alunos;
DROP TRIGGER IF EXISTS trg_sync_revista_licenca_pool_del ON public.revista_licenca_alunos;
DROP TRIGGER IF EXISTS trg_sync_revista_licenca_pool_upd ON public.revista_licenca_alunos;

CREATE TRIGGER trg_sync_revista_licenca_pool_ins
  AFTER INSERT ON public.revista_licenca_alunos
  FOR EACH ROW EXECUTE FUNCTION public.sync_revista_licenca_pool();

CREATE TRIGGER trg_sync_revista_licenca_pool_del
  AFTER DELETE ON public.revista_licenca_alunos
  FOR EACH ROW EXECUTE FUNCTION public.sync_revista_licenca_pool();

CREATE TRIGGER trg_sync_revista_licenca_pool_upd
  AFTER UPDATE ON public.revista_licenca_alunos
  FOR EACH ROW EXECUTE FUNCTION public.sync_revista_licenca_pool();

-- 2. Backfill: recalcular quantidade_usada com base na contagem real
UPDATE public.revista_licencas rl
   SET quantidade_usada = COALESCE(sub.cnt, 0),
       updated_at = now()
  FROM (
    SELECT licenca_id, COUNT(*) AS cnt
      FROM public.revista_licenca_alunos
     GROUP BY licenca_id
  ) sub
 WHERE rl.id = sub.licenca_id
   AND rl.quantidade_usada IS DISTINCT FROM sub.cnt;

-- Também zerar pool de licenças sem alunos cuja contagem registrada está errada
UPDATE public.revista_licencas
   SET quantidade_usada = 0,
       updated_at = now()
 WHERE quantidade_usada > 0
   AND id NOT IN (SELECT DISTINCT licenca_id FROM public.revista_licenca_alunos);

-- 3. RLS: permitir SE ler suas próprias licenças
DROP POLICY IF EXISTS "SE can view own licencas" ON public.revista_licencas;

CREATE POLICY "SE can view own licencas"
  ON public.revista_licencas
  FOR SELECT
  TO authenticated
  USING (
    superintendente_id IN (
      SELECT id FROM public.ebd_clientes
       WHERE superintendente_user_id = auth.uid()
    )
  );