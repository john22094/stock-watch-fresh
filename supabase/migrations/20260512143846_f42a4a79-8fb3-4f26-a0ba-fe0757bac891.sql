
CREATE TABLE IF NOT EXISTS public.mapa_layout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL UNIQUE,
  recepcao_x INTEGER NOT NULL DEFAULT 40,
  recepcao_y INTEGER NOT NULL DEFAULT 60,
  recepcao_largura INTEGER NOT NULL DEFAULT 140,
  recepcao_altura INTEGER NOT NULL DEFAULT 160,
  expedicao_x INTEGER NOT NULL DEFAULT 40,
  expedicao_y INTEGER NOT NULL DEFAULT 600,
  expedicao_largura INTEGER NOT NULL DEFAULT 140,
  expedicao_altura INTEGER NOT NULL DEFAULT 140,
  paletes_x INTEGER NOT NULL DEFAULT 460,
  paletes_y INTEGER NOT NULL DEFAULT 760,
  paletes_largura INTEGER NOT NULL DEFAULT 360,
  paletes_altura INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mapa_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem layout" ON public.mapa_layout FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Gerente/Encarregado inserem layout" ON public.mapa_layout FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id()
    AND (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'encarregado')));

CREATE POLICY "Gerente/Encarregado atualizam layout" ON public.mapa_layout FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id()
    AND (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'encarregado')));

CREATE POLICY "Gerente remove layout" ON public.mapa_layout FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

CREATE TRIGGER trg_mapa_layout_updated
  BEFORE UPDATE ON public.mapa_layout
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime (idempotente)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mapa_layout; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.setores; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.estoque; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mapa_movimentacoes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
