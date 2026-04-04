
CREATE TABLE public.revista_acessos_geo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp text,
  revista_id uuid REFERENCES revistas_digitais(id) ON DELETE SET NULL,
  ip text,
  cidade text,
  estado text,
  pais text DEFAULT 'BR',
  latitude numeric,
  longitude numeric,
  latitude_gps numeric,
  longitude_gps numeric,
  precisao_gps numeric,
  fonte_localizacao text DEFAULT 'ip',
  user_agent text,
  is_mobile boolean DEFAULT false,
  screen_width integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.revista_acessos_geo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert" ON public.revista_acessos_geo
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update" ON public.revista_acessos_geo
  FOR UPDATE TO anon USING (true);

CREATE POLICY "admin_select" ON public.revista_acessos_geo
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gerente_ebd')
    )
  );
