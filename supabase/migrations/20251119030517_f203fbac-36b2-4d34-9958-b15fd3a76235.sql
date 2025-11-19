-- Add video_url column to stage_info_texts table
ALTER TABLE public.stage_info_texts
ADD COLUMN video_url TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stage_info_texts_stage_id 
ON public.stage_info_texts(stage_id);

-- Insert default stage info texts if they don't exist
INSERT INTO public.stage_info_texts (stage_id, info_text)
SELECT 1, 'Nesta etapa, realizamos a contratação dos serviços. Você precisará fornecer os dados do presidente, revisar e assinar o contrato, e efetuar o pagamento do primeiro boleto mensal.'
WHERE NOT EXISTS (SELECT 1 FROM public.stage_info_texts WHERE stage_id = 1);

INSERT INTO public.stage_info_texts (stage_id, info_text)
SELECT 2, 'O certificado digital é essencial para assinar documentos eletronicamente. O custo é de R$ 150,00 anual. Após o pagamento, coletaremos seus dados e agendaremos a certificação.'
WHERE NOT EXISTS (SELECT 1 FROM public.stage_info_texts WHERE stage_id = 2);

INSERT INTO public.stage_info_texts (stage_id, info_text)
SELECT 3, 'Nesta etapa, verificamos a viabilidade do endereço para funcionamento da igreja. Você precisará enviar uma cópia do IPTU do imóvel.'
WHERE NOT EXISTS (SELECT 1 FROM public.stage_info_texts WHERE stage_id = 3);

INSERT INTO public.stage_info_texts (stage_id, info_text)
SELECT 4, 'Elaboramos todos os documentos necessários para o registro da igreja. Você precisará fornecer os dados completos da diretoria (7 pessoas) através de um formulário específico.'
WHERE NOT EXISTS (SELECT 1 FROM public.stage_info_texts WHERE stage_id = 4);

INSERT INTO public.stage_info_texts (stage_id, info_text)
SELECT 5, 'Os documentos serão registrados em cartório. O valor das custas é variável de acordo com cada cartório e será informado após o orçamento.'
WHERE NOT EXISTS (SELECT 1 FROM public.stage_info_texts WHERE stage_id = 5);

INSERT INTO public.stage_info_texts (stage_id, info_text)
SELECT 6, 'Etapa final! Realizamos o pedido do CNPJ junto à Receita Federal. Após a emissão, você receberá todos os documentos e poderá abrir conta bancária em nome da igreja.'
WHERE NOT EXISTS (SELECT 1 FROM public.stage_info_texts WHERE stage_id = 6);