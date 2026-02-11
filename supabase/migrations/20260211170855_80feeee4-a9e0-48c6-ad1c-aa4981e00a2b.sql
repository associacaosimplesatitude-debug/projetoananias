ALTER TABLE royalties_email_logs
  DROP CONSTRAINT royalties_email_logs_autor_id_fkey;

ALTER TABLE royalties_email_logs
  ADD CONSTRAINT royalties_email_logs_autor_id_fkey
  FOREIGN KEY (autor_id) REFERENCES royalties_autores(id) ON DELETE CASCADE;