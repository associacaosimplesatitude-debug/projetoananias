-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'client');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create churches (clients) table
CREATE TABLE public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  church_name TEXT NOT NULL,
  pastor_email TEXT NOT NULL,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  current_stage INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create church_stage_progress table
CREATE TABLE public.church_stage_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE NOT NULL,
  stage_id INT NOT NULL,
  sub_task_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (church_id, stage_id, sub_task_id)
);

-- Create stage_info_texts table (for admin to edit stage explanations)
CREATE TABLE public.stage_info_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id INT NOT NULL UNIQUE,
  info_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create variable_payments table (for cartório payments)
CREATE TABLE public.variable_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE NOT NULL,
  sub_task_id TEXT NOT NULL,
  amount DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (church_id, sub_task_id)
);

-- Create accounts_receivable table
CREATE TABLE public.accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create accounts_payable table
CREATE TABLE public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_info_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for churches
CREATE POLICY "Clients can view their own church"
  ON public.churches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Clients can update their own church"
  ON public.churches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all churches"
  ON public.churches FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all churches"
  ON public.churches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for church_stage_progress
CREATE POLICY "Clients can view their own progress"
  ON public.church_stage_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.churches
      WHERE churches.id = church_stage_progress.church_id
      AND churches.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all progress"
  ON public.church_stage_progress FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all progress"
  ON public.church_stage_progress FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for stage_info_texts
CREATE POLICY "Everyone can view stage info"
  ON public.stage_info_texts FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage stage info"
  ON public.stage_info_texts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for variable_payments
CREATE POLICY "Clients can view their own payments"
  ON public.variable_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.churches
      WHERE churches.id = variable_payments.church_id
      AND churches.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all payments"
  ON public.variable_payments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for accounts_receivable
CREATE POLICY "Admins can manage accounts receivable"
  ON public.accounts_receivable FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for accounts_payable
CREATE POLICY "Admins can manage accounts payable"
  ON public.accounts_payable FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_churches_updated_at
  BEFORE UPDATE ON public.churches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_church_stage_progress_updated_at
  BEFORE UPDATE ON public.church_stage_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stage_info_texts_updated_at
  BEFORE UPDATE ON public.stage_info_texts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_variable_payments_updated_at
  BEFORE UPDATE ON public.variable_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_receivable_updated_at
  BEFORE UPDATE ON public.accounts_receivable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_payable_updated_at
  BEFORE UPDATE ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default stage info texts
INSERT INTO public.stage_info_texts (stage_id, info_text) VALUES
  (1, 'Nesta etapa, realizamos a contratação dos serviços. Você precisará fornecer os dados do presidente, revisar e assinar o contrato, e efetuar o pagamento do primeiro boleto mensal.'),
  (2, 'O certificado digital é essencial para assinar documentos eletronicamente. O custo é de R$ 150,00 anual. Após o pagamento, coletaremos seus dados e agendaremos a certificação.'),
  (3, 'Nesta etapa, verificamos a viabilidade do endereço para funcionamento da igreja. Você precisará enviar uma cópia do IPTU do imóvel.'),
  (4, 'Elaboramos todos os documentos necessários para o registro da igreja. Você precisará fornecer os dados completos da diretoria (7 pessoas) através de um formulário específico.'),
  (5, 'Os documentos serão registrados em cartório. O valor das custas é variável de acordo com cada cartório e será informado após o orçamento.'),
  (6, 'Etapa final! Realizamos o pedido do CNPJ junto à Receita Federal. Após a emissão, você receberá todos os documentos e poderá abrir conta bancária em nome da igreja.');