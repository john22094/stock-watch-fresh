
-- Habilitar RLS na tabela cargos_hierarquia (tabela de referência, leitura pública para autenticados)
ALTER TABLE public.cargos_hierarquia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados veem cargos" ON public.cargos_hierarquia
  FOR SELECT TO authenticated
  USING (true);
