-- Allow gerente to delete audit logs from their company
CREATE POLICY "Gerente remove logs"
ON public.estoque_log
FOR DELETE
TO authenticated
USING (
  funcionario_id IN (
    SELECT id FROM public.funcionarios
    WHERE empresa_id = public.get_user_empresa_id()
  )
  AND public.has_role(auth.uid(), 'gerente'::app_role)
);

-- Also allow deleting orphan logs (funcionario_id IS NULL) for gerente
CREATE POLICY "Gerente remove logs orfaos"
ON public.estoque_log
FOR DELETE
TO authenticated
USING (
  funcionario_id IS NULL
  AND public.has_role(auth.uid(), 'gerente'::app_role)
);

-- Ensure realtime publication for audit log
ALTER TABLE public.estoque_log REPLICA IDENTITY FULL;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.estoque_log';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
END $$;