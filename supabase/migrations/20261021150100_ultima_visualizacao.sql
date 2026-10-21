-- A função de contagem passa a gravar também a ÚLTIMA abertura.
--
-- Nova migração (e não edição da 20261021120000) porque aquela já pode ter sido
-- aplicada; CREATE OR REPLACE mantém o tipo de retorno (integer), então não
-- exige DROP. Depende da coluna criada em 20261021150000 -- a ordem do nome do
-- arquivo garante isso, mas plpgsql não valida o corpo na criação: ao reaplicar
-- à mão, respeite a ordem.
CREATE OR REPLACE FUNCTION public.registrar_visualizacao_orcamento(_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.orcamentos
     SET visualizacoes = visualizacoes + 1,
         visto_em = coalesce(visto_em, now()),
         ultima_visualizacao_em = now()
   WHERE id = _id
  RETURNING visualizacoes;
$$;

REVOKE ALL ON FUNCTION public.registrar_visualizacao_orcamento(uuid) FROM PUBLIC, anon, authenticated;
