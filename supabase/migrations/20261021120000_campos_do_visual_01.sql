-- Campos que as telas do Visual 01 mostram e o banco não guardava.
--
-- Cada um responde uma pergunta que a equipe faz todo dia e que hoje não tem
-- resposta no sistema:
--
--   deals.temperatura        "este negócio está quente?"  (escolha do vendedor)
--   deals.etapa_desde        "há quantos dias está parado nesta etapa?"
--   orcamentos.visualizacoes "o cliente abriu a proposta quantas vezes?"
--   whatsapp_messages.lida_em "quantas mensagens ninguém leu ainda?"
--   organizations.meta_mensal "quanto falta para a meta do mês?"
--
-- Tudo é ADITIVO e com valor nulo ou padrão: o frontend que ainda não conhece
-- as colunas continua funcionando, e o que já conhece trata a ausência.

-- ── Negócio: temperatura ───────────────────────────────────────────────────
-- Três valores e nulo. Nulo é "ninguém classificou", e é diferente de "frio":
-- mostrar frio para o que não foi avaliado inventaria uma avaliação.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS temperatura text
    CHECK (temperatura IN ('quente', 'morno', 'frio'));

COMMENT ON COLUMN public.deals.temperatura IS
  'Avaliação do vendedor: quente, morno ou frio. Nulo = não classificado.';

-- ── Negócio: desde quando está na etapa ────────────────────────────────────
-- `updated_at` não serve: anda com QUALQUER edição (trocar o valor, o título),
-- e "parado há 2 dias" viraria "editado há 2 dias".
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS etapa_desde timestamptz;

-- Backfill: sem histórico de mudança de etapa, a melhor aproximação honesta é
-- a criação do negócio. Fica registrado no comentário para ninguém ler o
-- passado como medido.
UPDATE public.deals SET etapa_desde = coalesce(created_at, now()) WHERE etapa_desde IS NULL;

ALTER TABLE public.deals ALTER COLUMN etapa_desde SET DEFAULT now();
ALTER TABLE public.deals ALTER COLUMN etapa_desde SET NOT NULL;

COMMENT ON COLUMN public.deals.etapa_desde IS
  'Quando o negócio entrou na etapa atual. Mantido pelo gatilho deals_marca_etapa_desde. Para negócios anteriores a 2026-10-21 o valor é a data de criação (aproximação).';

CREATE OR REPLACE FUNCTION public.deals_marca_etapa_desde()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.etapa_desde := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_marca_etapa_desde ON public.deals;
CREATE TRIGGER deals_marca_etapa_desde
  BEFORE UPDATE OF stage_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_marca_etapa_desde();

-- ── Orçamento: quantas vezes foi aberto ────────────────────────────────────
-- `visto_em` continua sendo a PRIMEIRA abertura. O contador soma todas: três
-- aberturas em dois dias é sinal de compra que "visto em" sozinho esconde.
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS visualizacoes integer NOT NULL DEFAULT 0;

-- Quem já foi visto conta ao menos uma vez; o resto não é conhecido.
UPDATE public.orcamentos SET visualizacoes = 1 WHERE visto_em IS NOT NULL AND visualizacoes = 0;

COMMENT ON COLUMN public.orcamentos.visualizacoes IS
  'Aberturas do link público. Anteriores a 2026-10-21: 1 se já havia visto_em.';

-- Incremento atômico: duas abas abertas ao mesmo tempo não perdem contagem,
-- o que um `update ... set visualizacoes = <lido + 1>` feito na função perderia.
CREATE OR REPLACE FUNCTION public.registrar_visualizacao_orcamento(_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.orcamentos
     SET visualizacoes = visualizacoes + 1,
         visto_em = coalesce(visto_em, now())
   WHERE id = _id
  RETURNING visualizacoes;
$$;

-- Só a função do link público (service role) chama; usuário logado não conta.
REVOKE ALL ON FUNCTION public.registrar_visualizacao_orcamento(uuid) FROM PUBLIC, anon, authenticated;

-- ── WhatsApp: mensagem lida ────────────────────────────────────────────────
-- Vale para mensagem RECEBIDA. A de saída já tem `status` (sent/delivered/read)
-- vindo do provedor, que é outra coisa: leitura pelo CLIENTE.
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS lida_em timestamptz;

-- O histórico inteiro entra como lido: sem isso, a primeira abertura depois da
-- migração mostraria milhares de "não lidas" que ninguém deixou de ler.
UPDATE public.whatsapp_messages SET lida_em = created_at
 WHERE lida_em IS NULL AND direction = 'inbound';

CREATE INDEX IF NOT EXISTS idx_whatsapp_nao_lidas
  ON public.whatsapp_messages (org_id, contact_id)
  WHERE lida_em IS NULL AND direction = 'inbound';

-- Marcar a conversa como lida pela função, e não por UPDATE direto: a tabela
-- não precisa de política de escrita aberta para o app, e a função confere a
-- organização de quem chama.
CREATE OR REPLACE FUNCTION public.marcar_conversa_lida(_contact_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid := public.get_user_org_id(auth.uid());
  _n integer;
BEGIN
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Sem organização' USING ERRCODE = '42501';
  END IF;
  UPDATE public.whatsapp_messages
     SET lida_em = now()
   WHERE org_id = _org
     AND contact_id = _contact_id
     AND direction = 'inbound'
     AND lida_em IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_conversa_lida(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_conversa_lida(uuid) TO authenticated;

-- ── Organização: meta mensal de vendas ─────────────────────────────────────
-- Uma meta da empresa, em valor. A tela de Metas por vendedor foi removida; o
-- painel e o funil precisam só de "quanto do mês já foi".
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS meta_mensal numeric(14, 2)
    CHECK (meta_mensal IS NULL OR meta_mensal > 0);

COMMENT ON COLUMN public.organizations.meta_mensal IS
  'Meta de vendas ganhas por mês, na moeda da organização. Nulo = sem meta.';
