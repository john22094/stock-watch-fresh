
-- 1. Add missing columns to funcionarios
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS sobrenome VARCHAR DEFAULT '';
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- 2. Create estoque_log table
CREATE TABLE IF NOT EXISTS public.estoque_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estoque_id UUID REFERENCES public.estoque(id) ON DELETE SET NULL,
  acao VARCHAR NOT NULL,
  funcionario_id UUID,
  matricula VARCHAR,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.estoque_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view logs" ON public.estoque_log
  FOR SELECT TO authenticated
  USING (funcionario_id IN (SELECT id FROM public.funcionarios WHERE empresa_id = public.get_user_empresa_id()));

-- 3. Fix gerar_matricula return type
DROP FUNCTION IF EXISTS public.gerar_matricula();
CREATE OR REPLACE FUNCTION public.gerar_matricula()
RETURNS VARCHAR LANGUAGE plpgsql AS $$
DECLARE v_mat VARCHAR;
BEGIN
  LOOP
    v_mat := 'VH-' || EXTRACT(YEAR FROM now())::TEXT || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE matricula = v_mat);
  END LOOP;
  RETURN v_mat;
END;
$$;

-- 4. Protect matricula trigger
CREATE OR REPLACE FUNCTION public.protect_matricula()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.matricula IS DISTINCT FROM NEW.matricula THEN
    RAISE EXCEPTION 'Erro de Integridade: A matrícula é gerada no ato da contratação e não pode ser modificada.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_matricula ON public.funcionarios;
CREATE TRIGGER trg_protect_matricula BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.protect_matricula();

-- 5. Audit log trigger
CREATE OR REPLACE FUNCTION public.log_estoque_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_func_id UUID; v_mat VARCHAR;
BEGIN
  SELECT id, matricula INTO v_func_id, v_mat FROM public.funcionarios WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO public.estoque_log (estoque_id, acao, funcionario_id, matricula, detalhes)
  VALUES (COALESCE(NEW.id, OLD.id), TG_OP, v_func_id, v_mat,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_estoque ON public.estoque;
CREATE TRIGGER trg_log_estoque AFTER INSERT OR UPDATE OR DELETE ON public.estoque
  FOR EACH ROW EXECUTE FUNCTION public.log_estoque_change();

-- 6. RH create employee function
CREATE OR REPLACE FUNCTION public.criar_funcionario_rh(
  p_nome VARCHAR, p_sobrenome VARCHAR, p_cpf VARCHAR, p_data_nascimento DATE,
  p_cargo public.app_role, p_empresa_id UUID, p_nome_mercado VARCHAR
)
RETURNS TABLE(matricula VARCHAR, email_corporativo VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_mat VARCHAR; v_email VARCHAR; v_nome_clean VARCHAR; v_sobrenome_clean VARCHAR;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE user_id = auth.uid() AND cargo IN ('rh', 'gerente')) THEN
    RAISE EXCEPTION 'Apenas RH ou Gerente podem cadastrar funcionários.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.funcionarios WHERE funcionarios.cpf = p_cpf) THEN
    RAISE EXCEPTION 'CPF já cadastrado no sistema.';
  END IF;
  v_mat := public.gerar_matricula();
  v_nome_clean := lower(translate(p_nome, 'áàãâéèêíìîóòõôúùûçÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ ', 'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC'));
  v_sobrenome_clean := lower(translate(p_sobrenome, 'áàãâéèêíìîóòõôúùûçÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ ', 'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC'));
  v_email := v_nome_clean || '.' || v_sobrenome_clean || '@' || lower(replace(p_nome_mercado, ' ', '')) || '.com.br';
  RETURN QUERY SELECT v_mat, v_email;
END;
$$;

-- 7. Triple-check password reset
CREATE OR REPLACE FUNCTION public.verificar_reset_senha(p_matricula VARCHAR, p_email VARCHAR, p_cpf VARCHAR)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM public.funcionarios WHERE matricula = p_matricula AND cpf = p_cpf LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Dados inconsistentes. Entre em contato com o suporte do RH.';
  END IF;
  RETURN v_user_id;
END;
$$;
