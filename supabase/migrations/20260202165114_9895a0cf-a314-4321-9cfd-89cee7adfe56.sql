-- Ajustar constraint de royalties_resgates para CASCADE
ALTER TABLE royalties_resgates
DROP CONSTRAINT IF EXISTS royalties_resgates_autor_id_fkey;

ALTER TABLE royalties_resgates
ADD CONSTRAINT royalties_resgates_autor_id_fkey
FOREIGN KEY (autor_id) REFERENCES royalties_autores(id)
ON DELETE CASCADE;