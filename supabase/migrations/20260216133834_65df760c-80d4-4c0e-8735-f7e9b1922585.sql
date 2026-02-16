
ALTER TABLE public.ebd_email_logs
  ADD COLUMN email_aberto boolean NOT NULL DEFAULT false,
  ADD COLUMN data_abertura timestamptz,
  ADD COLUMN link_clicado boolean NOT NULL DEFAULT false,
  ADD COLUMN data_clique timestamptz;
