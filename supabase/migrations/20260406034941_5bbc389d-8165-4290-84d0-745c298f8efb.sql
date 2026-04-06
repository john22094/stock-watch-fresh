
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_empresa_id UUID;
  new_role app_role;
  raw_meta JSONB;
  v_matricula TEXT;
  v_deve_trocar BOOLEAN;
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
    v_deve_trocar := false;
  ELSE
    new_empresa_id := (raw_meta->>'empresa_id')::UUID;
    new_role := COALESCE((raw_meta->>'cargo')::app_role, 'repositor');
    v_matricula := public.gerar_matricula();
    v_deve_trocar := COALESCE((raw_meta->>'deve_trocar_senha')::boolean, false);
  END IF;

  INSERT INTO public.funcionarios (user_id, empresa_id, nome, sobrenome, cpf, matricula, cargo, status, cbo, deve_trocar_senha)
  VALUES (
    NEW.id,
    new_empresa_id,
    COALESCE(raw_meta->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(raw_meta->>'sobrenome', ''),
    raw_meta->>'cpf',
    v_matricula,
    new_role,
    CASE WHEN new_role = 'gerente' THEN 'ativo' ELSE 'pendente' END,
    COALESCE(raw_meta->>'cbo', ''),
    v_deve_trocar
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, new_role);
  RETURN NEW;
END;
$function$;
