
-- 1. CPF immutability trigger
CREATE OR REPLACE FUNCTION public.protect_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.cpf IS NOT NULL AND OLD.cpf IS DISTINCT FROM NEW.cpf THEN
    RAISE EXCEPTION 'Erro de Integridade: O CPF não pode ser modificado após o cadastro.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_cpf ON public.funcionarios;
CREATE TRIGGER trg_protect_cpf
  BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_cpf();

-- 2. Update handle_new_user for matricula 001
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_empresa_id UUID;
  new_role app_role;
  raw_meta JSONB;
  v_matricula TEXT;
BEGIN
  raw_meta := NEW.raw_user_meta_data;
  
  IF raw_meta->>'cnpj' IS NOT NULL AND raw_meta->>'cnpj' != '' THEN
    INSERT INTO public.empresas (nome, cnpj, endereco)
    VALUES (
      COALESCE(raw_meta->>'nome_mercado', 'Mercado'),
      raw_meta->>'cnpj',
      COALESCE(raw_meta->>'endereco', '')
    )
    RETURNING id INTO new_empresa_id;
    
    new_role := 'gerente';
    v_matricula := '001';
  ELSE
    new_empresa_id := (raw_meta->>'empresa_id')::UUID;
    new_role := COALESCE((raw_meta->>'cargo')::app_role, 'repositor');
    v_matricula := public.gerar_matricula();
  END IF;

  INSERT INTO public.funcionarios (user_id, empresa_id, nome, sobrenome, cpf, matricula, cargo, status)
  VALUES (
    NEW.id,
    new_empresa_id,
    COALESCE(raw_meta->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(raw_meta->>'sobrenome', ''),
    raw_meta->>'cpf',
    v_matricula,
    new_role,
    CASE WHEN new_role = 'gerente' THEN 'ativo' ELSE 'pendente' END
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, new_role);
  RETURN NEW;
END;
$$;

-- 3. RH RLS policies (using security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_rh(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE user_id = _user_id AND cargo::text = 'rh'
  )
$$;

DROP POLICY IF EXISTS "RH pode inserir funcionarios" ON public.funcionarios;
CREATE POLICY "RH pode inserir funcionarios"
  ON public.funcionarios FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id() AND public.is_rh(auth.uid()));

DROP POLICY IF EXISTS "RH pode atualizar funcionarios" ON public.funcionarios;
CREATE POLICY "RH pode atualizar funcionarios"
  ON public.funcionarios FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id() AND public.is_rh(auth.uid()));

DROP POLICY IF EXISTS "RH remove paletes" ON public.paletes;
CREATE POLICY "RH remove paletes"
  ON public.paletes FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id() AND public.is_rh(auth.uid()));
