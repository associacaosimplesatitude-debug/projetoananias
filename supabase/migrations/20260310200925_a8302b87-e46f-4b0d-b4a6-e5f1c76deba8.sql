
-- Create campaign_links table
CREATE TABLE public.campaign_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  campaign_id uuid REFERENCES public.whatsapp_campanhas(id) ON DELETE CASCADE,
  customer_name text,
  customer_email text,
  customer_phone text,
  last_order_date date,
  last_products text[],
  last_order_value numeric,
  has_discount boolean DEFAULT false,
  discount_percentage numeric DEFAULT 0,
  final_discount numeric DEFAULT 0,
  access_email text,
  access_password text,
  panel_url text,
  first_accessed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create campaign_events table
CREATE TABLE public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES public.campaign_links(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.whatsapp_campanhas(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Add tracking columns to whatsapp_campanhas
ALTER TABLE public.whatsapp_campanhas
  ADD COLUMN IF NOT EXISTS total_link_clicks int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_page_views int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_panel_accesses int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_purchases int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue numeric DEFAULT 0;

-- RLS for campaign_links: public read (landing page accessed without login)
ALTER TABLE public.campaign_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read campaign_links by token"
  ON public.campaign_links FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage campaign_links"
  ON public.campaign_links FOR ALL
  TO authenticated
  USING (public.is_admin_geral(auth.uid()));

-- RLS for campaign_events: public insert, admin read
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert campaign_events"
  ON public.campaign_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read campaign_events"
  ON public.campaign_events FOR SELECT
  TO authenticated
  USING (public.is_admin_geral(auth.uid()));

-- Indexes
CREATE INDEX idx_campaign_links_token ON public.campaign_links(token);
CREATE INDEX idx_campaign_links_campaign_id ON public.campaign_links(campaign_id);
CREATE INDEX idx_campaign_events_link_id ON public.campaign_events(link_id);
CREATE INDEX idx_campaign_events_campaign_id ON public.campaign_events(campaign_id);
