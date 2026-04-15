
ALTER TABLE public.estoque DISABLE TRIGGER trg_log_estoque;

DELETE FROM public.estoque_log;
DELETE FROM public.notificacoes;
DELETE FROM public.estoque;
DELETE FROM public.prateleiras;
DELETE FROM public.paletes;
DELETE FROM public.produtos;
DELETE FROM public.funcionarios;
DELETE FROM public.user_roles;
DELETE FROM public.empresas;

ALTER TABLE public.estoque ENABLE TRIGGER trg_log_estoque;

ALTER TABLE public.estoque DROP CONSTRAINT IF EXISTS estoque_registrado_por_fkey;
ALTER TABLE public.estoque ADD CONSTRAINT estoque_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.funcionarios(id);
