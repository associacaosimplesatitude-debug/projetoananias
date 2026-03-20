ALTER TABLE sorteio_participantes 
  DROP CONSTRAINT sorteio_participantes_sessao_id_fkey,
  ADD CONSTRAINT sorteio_participantes_sessao_id_fkey 
    FOREIGN KEY (sessao_id) REFERENCES sorteio_sessoes(id) ON DELETE SET NULL;

ALTER TABLE sorteio_participantes ALTER COLUMN sessao_id DROP NOT NULL;