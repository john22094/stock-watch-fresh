-- Drop existing FKs if present then recreate with proper cascade rules
ALTER TABLE public.estoque DROP CONSTRAINT IF EXISTS estoque_produto_id_fkey;
ALTER TABLE public.estoque DROP CONSTRAINT IF EXISTS estoque_palete_id_fkey;
ALTER TABLE public.estoque DROP CONSTRAINT IF EXISTS estoque_prateleira_id_fkey;
ALTER TABLE public.estoque DROP CONSTRAINT IF EXISTS estoque_empresa_id_fkey;
ALTER TABLE public.estoque DROP CONSTRAINT IF EXISTS estoque_registrado_por_fkey;
ALTER TABLE public.prateleiras DROP CONSTRAINT IF EXISTS prateleiras_palete_id_fkey;
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_empresa_id_fkey;
ALTER TABLE public.paletes DROP CONSTRAINT IF EXISTS paletes_empresa_id_fkey;

ALTER TABLE public.estoque ADD CONSTRAINT estoque_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE CASCADE;
ALTER TABLE public.estoque ADD CONSTRAINT estoque_palete_id_fkey FOREIGN KEY (palete_id) REFERENCES public.paletes(id) ON DELETE SET NULL;
ALTER TABLE public.estoque ADD CONSTRAINT estoque_prateleira_id_fkey FOREIGN KEY (prateleira_id) REFERENCES public.prateleiras(id) ON DELETE SET NULL;
ALTER TABLE public.estoque ADD CONSTRAINT estoque_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.estoque ADD CONSTRAINT estoque_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.funcionarios(id) ON DELETE SET NULL;
ALTER TABLE public.prateleiras ADD CONSTRAINT prateleiras_palete_id_fkey FOREIGN KEY (palete_id) REFERENCES public.paletes(id) ON DELETE CASCADE;
ALTER TABLE public.produtos ADD CONSTRAINT produtos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.paletes ADD CONSTRAINT paletes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_estoque_empresa ON public.estoque(empresa_id);
CREATE INDEX IF NOT EXISTS idx_estoque_produto ON public.estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_palete ON public.estoque(palete_id);
CREATE INDEX IF NOT EXISTS idx_estoque_prateleira ON public.estoque(prateleira_id);
CREATE INDEX IF NOT EXISTS idx_estoque_validade ON public.estoque(data_validade);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_paletes_empresa ON public.paletes(empresa_id);

ALTER TABLE public.estoque REPLICA IDENTITY FULL;
ALTER TABLE public.produtos REPLICA IDENTITY FULL;
ALTER TABLE public.paletes REPLICA IDENTITY FULL;
ALTER TABLE public.prateleiras REPLICA IDENTITY FULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.estoque; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.paletes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.prateleiras; EXCEPTION WHEN duplicate_object THEN NULL; END $$;