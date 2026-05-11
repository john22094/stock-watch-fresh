
-- MARCAS
CREATE TABLE public.marcas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem marcas" ON public.marcas FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Gerente/Encarregado inserem marcas" ON public.marcas FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id() AND (has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'encarregado')));
CREATE POLICY "Gerente/Encarregado atualizam marcas" ON public.marcas FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id() AND (has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'encarregado')));
CREATE POLICY "Gerente remove marcas" ON public.marcas FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id() AND has_role(auth.uid(),'gerente'));

CREATE TRIGGER trg_marcas_updated BEFORE UPDATE ON public.marcas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SETORES
CREATE TABLE public.setores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#94a3b8',
  pos_x INTEGER NOT NULL DEFAULT 0,
  pos_y INTEGER NOT NULL DEFAULT 0,
  largura INTEGER NOT NULL DEFAULT 300,
  altura INTEGER NOT NULL DEFAULT 200,
  marca_id UUID REFERENCES public.marcas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem setores" ON public.setores FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Gerente/Encarregado inserem setores" ON public.setores FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id() AND (has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'encarregado')));
CREATE POLICY "Gerente/Encarregado atualizam setores" ON public.setores FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id() AND (has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'encarregado')));
CREATE POLICY "Gerente remove setores" ON public.setores FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id() AND has_role(auth.uid(),'gerente'));

CREATE TRIGGER trg_setores_updated BEFORE UPDATE ON public.setores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRATELEIRAS: novas colunas
ALTER TABLE public.prateleiras
  ADD COLUMN pos_x INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN pos_y INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN largura INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN altura INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN cor TEXT,
  ADD COLUMN capacidade INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN marca_id UUID REFERENCES public.marcas(id) ON DELETE SET NULL,
  ADD COLUMN setor_id UUID REFERENCES public.setores(id) ON DELETE SET NULL,
  ADD COLUMN observacoes TEXT;

-- MOVIMENTAÇÕES DO MAPA
CREATE TABLE public.mapa_movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  estoque_id UUID,
  origem_prateleira UUID,
  destino_prateleira UUID,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mapa_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem movimentacoes" ON public.mapa_movimentacoes FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Membros inserem movimentacoes" ON public.mapa_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id());

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.marcas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.setores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mapa_movimentacoes;
