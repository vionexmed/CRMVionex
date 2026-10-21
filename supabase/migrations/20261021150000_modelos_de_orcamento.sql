-- Modelos de orçamento + colunas novas de orcamentos.
--
-- Tudo ADITIVO: o frontend antigo continua funcionando sem estas colunas, e o
-- novo trata a ausência (erro 42703 / tabela inexistente) como "ainda não há".
--
-- orcamentos.ultima_visualizacao_em  "quando o cliente abriu pela última vez?"
--   (`visto_em` guarda só a PRIMEIRA abertura; a função que preenche esta é
--   atualizada em 20261021150100_ultima_visualizacao.sql)
-- orcamentos.condicoes               nota que o CLIENTE lê ("2 parcelas, plano
--   cobrado mensalmente"). Separada de `observacoes`, que é INTERNA e nunca
--   sai na página pública.
-- orcamento_modelos                  propostas prontas para reaproveitar.

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS ultima_visualizacao_em timestamptz;

UPDATE public.orcamentos SET ultima_visualizacao_em = visto_em
 WHERE visto_em IS NOT NULL AND ultima_visualizacao_em IS NULL;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS condicoes text;

COMMENT ON COLUMN public.orcamentos.condicoes IS
  'Condições de pagamento visíveis ao cliente na proposta. Diferente de observacoes, que é interna.';

-- ── Modelos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orcamento_modelos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome          text NOT NULL CHECK (length(btrim(nome)) > 0),
  -- Cópia dos itens como ofertados: [{produto_id, nome, descricao, unidade,
  -- preco_unit, quantidade, desconto}]. Json e não tabela filha: o modelo é
  -- sempre lido e gravado por inteiro, e o PostgREST não faz transação -- uma
  -- escrita só evita modelo pela metade.
  itens         jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens) = 'array'),
  -- Quantos dias de validade o orçamento criado a partir do modelo ganha.
  validade_dias integer CHECK (validade_dias IS NULL OR validade_dias BETWEEN 1 AND 365),
  desconto      numeric(14,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  titulo        text,
  condicoes     text,
  observacoes   text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orcamento_modelos_org_idx
  ON public.orcamento_modelos (org_id, nome);

ALTER TABLE public.orcamento_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamento_modelos_rw ON public.orcamento_modelos;
CREATE POLICY orcamento_modelos_rw ON public.orcamento_modelos FOR ALL
  USING (public.user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (public.user_belongs_to_org(auth.uid(), org_id));

COMMENT ON TABLE public.orcamento_modelos IS
  'Modelos de orçamento da organização. Os itens são cópia: mudar o catálogo não muda o modelo.';
