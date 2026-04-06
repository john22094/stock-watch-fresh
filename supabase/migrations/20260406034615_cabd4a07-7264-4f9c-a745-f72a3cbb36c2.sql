
-- Add weight to estoque
ALTER TABLE public.estoque ADD COLUMN IF NOT EXISTS peso NUMERIC DEFAULT NULL;

-- Add description to produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT NULL;

-- Add must_change_password flag to funcionarios
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS deve_trocar_senha BOOLEAN NOT NULL DEFAULT false;
