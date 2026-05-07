-- Limpar logs órfãos
DELETE FROM public.estoque_log
WHERE estoque_id IS NOT NULL
  AND estoque_id NOT IN (SELECT id FROM public.estoque);

-- Recriar FK com ON DELETE CASCADE
ALTER TABLE public.estoque_log
  DROP CONSTRAINT IF EXISTS estoque_log_estoque_id_fkey;

ALTER TABLE public.estoque_log
  ADD CONSTRAINT estoque_log_estoque_id_fkey
  FOREIGN KEY (estoque_id)
  REFERENCES public.estoque(id)
  ON DELETE CASCADE;

-- Garantir que o trigger de log não bloqueie deletes em massa:
-- O log é gravado via trigger AFTER em estoque. Quando deletamos estoque,
-- o trigger insere uma linha em estoque_log com o id do registro deletado.
-- Com ON DELETE CASCADE acima, o log recém-criado seria removido em seguida
-- pela própria cascata. Para evitar a janela de violação, ajustamos a função
-- para gravar NULL em estoque_id quando a ação for DELETE.
CREATE OR REPLACE FUNCTION public.log_estoque_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_func_id UUID; v_mat VARCHAR;
BEGIN
  SELECT id, matricula INTO v_func_id, v_mat
  FROM public.funcionarios WHERE user_id = auth.uid() LIMIT 1;

  INSERT INTO public.estoque_log (estoque_id, acao, funcionario_id, matricula, detalhes)
  VALUES (
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.id END,
    TG_OP,
    v_func_id,
    v_mat,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;