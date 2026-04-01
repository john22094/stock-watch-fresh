
ALTER FUNCTION public.gerar_matricula() SET search_path = public;
ALTER FUNCTION public.protect_matricula() SET search_path = public;
ALTER FUNCTION public.log_estoque_change() SET search_path = public;
ALTER FUNCTION public.criar_funcionario_rh(VARCHAR, VARCHAR, VARCHAR, DATE, public.app_role, UUID, VARCHAR) SET search_path = public;
ALTER FUNCTION public.verificar_reset_senha(VARCHAR, VARCHAR, VARCHAR) SET search_path = public;
