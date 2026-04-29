UPDATE public.revistas_digitais rd
SET total_licoes = sub.total
FROM (
  SELECT revista_id, SUM(COALESCE(array_length(paginas, 1), 0))::int AS total
  FROM public.revista_licoes
  GROUP BY revista_id
) sub
WHERE rd.id = sub.revista_id
  AND rd.tipo_conteudo IN ('livro_digital', 'infografico')
  AND rd.total_licoes IS DISTINCT FROM sub.total;