-- Números da tela de Produtos, todos derivados de orçamento APROVADO e de
-- negócio GANHO -- a conclusão, não a intenção (ver "Métricas do painel" no
-- CLAUDE.md): orçamento enviado ou rascunho não é venda.
--
-- Devolve jsonb e não TABLE: o formato é uma lista por produto mais três totais,
-- e RETURNS TABLE com alias de CTE igual a coluna de retorno dá
-- "ambiguous column reference" só em execução.
--
--   por_produto[].clientes      empresas (ou contatos, ou o próprio orçamento,
--                               nessa ordem) distintas com orçamento aprovado
--                               que cita o produto
--   por_produto[].vendas_mes    orçamentos aprovados no mês de `_agora`, pela data
--                               da DECISÃO (decidido_em), no fuso de São Paulo
--   receita_recorrente          soma de preço x clientes dos produtos ATIVOS,
--                               em reais, de tipo recorrente ou adicional
--   mais_vendido                o produto recorrente/adicional que mais rende
--                               (preço x clientes); só sem nenhum deles cai para
--                               o de mais clientes. Por clientes puro, o plano
--                               de entrada (barato, muita gente) ganharia sempre
--                               do que sustenta a receita. Empate: nome.
--   tipo                        tipo_cobranca; nulo vira "recorrente" quando a
--                               unidade é um período (mês, ano...), como a tela
--   ticket_medio                média de deals.value dos negócios ganhos, COM ou SEM
--                               contato: aqui não é métrica de SDR, e negócio ganho
--                               direto no quadro também é dinheiro que entrou

CREATE OR REPLACE FUNCTION public.produtos_metricas(
  _org_id uuid,
  _agora  timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _ini timestamptz := date_trunc('month', _agora AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  _fim timestamptz := (date_trunc('month', _agora AT TIME ZONE 'America/Sao_Paulo') + interval '1 month') AT TIME ZONE 'America/Sao_Paulo';
  _resultado jsonb;
BEGIN
  -- SECURITY DEFINER não passa por RLS: sem isto vazaria número de outra empresa.
  IF auth.uid() IS NOT NULL AND NOT public.user_belongs_to_org(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Sem permissão nesta organização';
  END IF;

  WITH aprovados AS (
    SELECT o.id AS orc_id,
           coalesce(o.company_id, o.contact_id, o.id) AS cliente,
           o.decidido_em,
           i.produto_id
    FROM public.orcamentos o
    JOIN public.orcamento_itens i ON i.orcamento_id = o.id
    WHERE o.org_id = _org_id AND o.status = 'aprovado' AND i.produto_id IS NOT NULL
  ),
  por AS (
    SELECT a.produto_id,
           count(DISTINCT a.cliente)::int AS clientes,
           count(DISTINCT a.orc_id) FILTER (WHERE a.decidido_em >= _ini AND a.decidido_em < _fim)::int AS vendas_mes
    FROM aprovados a
    GROUP BY a.produto_id
  ),
  base AS (
    SELECT p.id, p.nome, p.preco, p.ativo, p.moeda,
           coalesce(p.tipo_cobranca,
             CASE WHEN p.unidade ~* '^(m[eê]s|mensal|ano|anual|semestre|trimestre|semana)($|[^[:alpha:]])'
                  THEN 'recorrente' ELSE 'unico' END) AS tipo,
           coalesce(por.clientes, 0) AS clientes,
           coalesce(por.vendas_mes, 0) AS vendas_mes
    FROM public.produtos p
    LEFT JOIN por ON por.produto_id = p.id
    WHERE p.org_id = _org_id
  )
  SELECT jsonb_build_object(
    'por_produto', coalesce((
      SELECT jsonb_agg(jsonb_build_object('produto_id', b.id, 'clientes', b.clientes, 'vendas_mes', b.vendas_mes))
      FROM base b), '[]'::jsonb),
    'receita_recorrente', coalesce((
      SELECT sum(b.preco * b.clientes) FROM base b
      WHERE b.ativo AND b.moeda = 'BRL' AND b.tipo IN ('recorrente', 'adicional')), 0),
    'mais_vendido', (
      SELECT jsonb_build_object('produto_id', b.id, 'nome', b.nome, 'clientes', b.clientes, 'vendas_mes', b.vendas_mes)
      FROM base b WHERE b.clientes > 0
      ORDER BY (b.tipo IN ('recorrente', 'adicional')) DESC,
               CASE WHEN b.tipo IN ('recorrente', 'adicional') THEN b.preco * b.clientes ELSE b.clientes END DESC,
               b.nome
      LIMIT 1),
    'ticket_medio', (
      SELECT avg(d.value) FROM public.deals d
      WHERE d.org_id = _org_id AND d.status IN ('won') AND d.value IS NOT NULL)
  ) INTO _resultado;

  RETURN _resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.produtos_metricas(uuid, timestamptz) TO authenticated;
