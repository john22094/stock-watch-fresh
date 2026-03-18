
-- ============================================
-- 1. ENUM E TABELA DE CARGOS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('gerente', 'encarregado', 'repositor');

CREATE TABLE public.cargos_hierarquia (
  id SERIAL PRIMARY KEY,
  nome_cargo TEXT NOT NULL UNIQUE,
  nivel_permissao INTEGER NOT NULL DEFAULT 3,
  descricao TEXT
);

INSERT INTO public.cargos_hierarquia (nome_cargo, nivel_permissao, descricao) VALUES
  ('Gerente', 1, 'Permissões completas: adicionar, editar, remover produtos, criar usuários, editar paletes e prateleiras, acessar relatórios'),
  ('Encarregado', 2, 'Pode adicionar produtos, editar validade, atualizar estoque, visualizar relatórios'),
  ('Repositor', 3, 'Pode escanear produtos, registrar validade, ver localização do produto, receber alertas');

-- ============================================
-- 2. TABELA DE EMPRESAS
-- ============================================
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  endereco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. TABELA DE FUNCIONÁRIOS (PROFILES)
-- ============================================
CREATE TABLE public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  matricula TEXT NOT NULL UNIQUE,
  cargo app_role NOT NULL DEFAULT 'repositor',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('ativo', 'inativo', 'pendente')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. TABELA DE ROLES (para has_role seguro)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. TABELA DE PALETES
-- ============================================
CREATE TABLE public.paletes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.paletes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. TABELA DE PRATELEIRAS
-- ============================================
CREATE TABLE public.prateleiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  palete_id UUID NOT NULL REFERENCES public.paletes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prateleiras ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. TABELA DE PRODUTOS
-- ============================================
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo_barras TEXT,
  categoria TEXT,
  marca TEXT,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_produtos_codigo_barras ON public.produtos(codigo_barras);

-- ============================================
-- 8. TABELA DE ESTOQUE
-- ============================================
CREATE TABLE public.estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  data_validade DATE NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  lote TEXT,
  prateleira_id UUID REFERENCES public.prateleiras(id),
  palete_id UUID REFERENCES public.paletes(id),
  data_entrada TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por UUID REFERENCES auth.users(id),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estoque_validade ON public.estoque(data_validade);
CREATE INDEX idx_estoque_produto ON public.estoque(produto_id);

-- ============================================
-- 9. TABELA DE NOTIFICAÇÕES
-- ============================================
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  estoque_id UUID REFERENCES public.estoque(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('vencimento_7dias', 'vencimento_3dias', 'vencimento_1dia', 'vencido')),
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. FUNÇÃO SECURITY DEFINER para checar role
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get empresa_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.funcionarios
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- ============================================
-- 11. RLS POLICIES
-- ============================================

-- Empresas: membros podem ver sua empresa
CREATE POLICY "Membros veem sua empresa" ON public.empresas
  FOR SELECT TO authenticated
  USING (id = public.get_user_empresa_id());

CREATE POLICY "Gerente pode atualizar empresa" ON public.empresas
  FOR UPDATE TO authenticated
  USING (id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

-- Funcionarios
CREATE POLICY "Membros veem colegas da empresa" ON public.funcionarios
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Gerente pode inserir funcionarios" ON public.funcionarios
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Gerente pode atualizar funcionarios" ON public.funcionarios
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Gerente pode remover funcionarios" ON public.funcionarios
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

-- User roles: apenas leitura para autenticados
CREATE POLICY "Usuarios veem seus roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Paletes: membros da empresa
CREATE POLICY "Membros veem paletes" ON public.paletes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Gerente/Encarregado inserem paletes" ON public.paletes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'encarregado')));

CREATE POLICY "Gerente atualiza paletes" ON public.paletes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Gerente remove paletes" ON public.paletes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

-- Prateleiras: via palete da empresa
CREATE POLICY "Membros veem prateleiras" ON public.prateleiras
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.paletes WHERE paletes.id = prateleiras.palete_id AND paletes.empresa_id = public.get_user_empresa_id()));

CREATE POLICY "Gerente/Encarregado inserem prateleiras" ON public.prateleiras
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.paletes WHERE paletes.id = palete_id AND paletes.empresa_id = public.get_user_empresa_id()) AND (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'encarregado')));

CREATE POLICY "Gerente atualiza prateleiras" ON public.prateleiras
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.paletes WHERE paletes.id = prateleiras.palete_id AND paletes.empresa_id = public.get_user_empresa_id()) AND public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Gerente remove prateleiras" ON public.prateleiras
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.paletes WHERE paletes.id = prateleiras.palete_id AND paletes.empresa_id = public.get_user_empresa_id()) AND public.has_role(auth.uid(), 'gerente'));

-- Produtos: membros da empresa
CREATE POLICY "Membros veem produtos" ON public.produtos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Gerente/Encarregado inserem produtos" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'encarregado')));

CREATE POLICY "Gerente/Encarregado atualizam produtos" ON public.produtos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'encarregado')));

CREATE POLICY "Gerente remove produtos" ON public.produtos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

-- Estoque: membros da empresa, repositor pode inserir
CREATE POLICY "Membros veem estoque" ON public.estoque
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Todos autenticados inserem estoque" ON public.estoque
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Gerente/Encarregado atualizam estoque" ON public.estoque
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'encarregado')));

CREATE POLICY "Gerente remove estoque" ON public.estoque
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.has_role(auth.uid(), 'gerente'));

-- Notificacoes: membros da empresa
CREATE POLICY "Membros veem notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Sistema insere notificacoes" ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Membros atualizam notificacoes" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- ============================================
-- 12. TRIGGER updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_funcionarios_updated_at BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estoque_updated_at BEFORE UPDATE ON public.estoque FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 13. FUNÇÃO DE GERAR MATRÍCULA ÚNICA
-- ============================================
CREATE OR REPLACE FUNCTION public.gerar_matricula()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nova_matricula TEXT;
  existe BOOLEAN;
BEGIN
  LOOP
    nova_matricula := 'VH-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.funcionarios WHERE matricula = nova_matricula) INTO existe;
    EXIT WHEN NOT existe;
  END LOOP;
  RETURN nova_matricula;
END;
$$;

-- ============================================
-- 14. TRIGGER: criar funcionario + empresa no signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_empresa_id UUID;
  new_role app_role;
  raw_meta JSONB;
BEGIN
  raw_meta := NEW.raw_user_meta_data;
  
  -- Se tem CNPJ no metadata, é cadastro de empresa (gerente)
  IF raw_meta->>'cnpj' IS NOT NULL AND raw_meta->>'cnpj' != '' THEN
    INSERT INTO public.empresas (nome, cnpj, endereco)
    VALUES (
      COALESCE(raw_meta->>'nome_mercado', 'Mercado'),
      raw_meta->>'cnpj',
      COALESCE(raw_meta->>'endereco', '')
    )
    RETURNING id INTO new_empresa_id;
    
    new_role := 'gerente';
  ELSE
    -- Funcionário vinculado a empresa existente
    new_empresa_id := (raw_meta->>'empresa_id')::UUID;
    new_role := COALESCE((raw_meta->>'cargo')::app_role, 'repositor');
  END IF;

  -- Criar funcionário
  INSERT INTO public.funcionarios (user_id, empresa_id, nome, cpf, matricula, cargo, status)
  VALUES (
    NEW.id,
    new_empresa_id,
    COALESCE(raw_meta->>'nome', split_part(NEW.email, '@', 1)),
    raw_meta->>'cpf',
    public.gerar_matricula(),
    new_role,
    CASE WHEN new_role = 'gerente' THEN 'ativo' ELSE 'pendente' END
  );

  -- Inserir role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, new_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
