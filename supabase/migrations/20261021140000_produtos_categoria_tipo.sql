-- Categoria e tipo de cobrança do produto: o que a tela de Produtos (Visual 01)
-- agrupa em abas e mostra no selo do cartão.
--
-- ADITIVO: as três colunas aceitam nulo, então produto antigo continua válido.
-- Nulo em `tipo_cobranca` é "ninguém classificou" -- a tela cai no que o
-- cadastro já dizia (a unidade: "mês" vira recorrente, o resto vira único)
-- em vez de inventar um tipo que a pessoa não escolheu.
--
--   categoria        texto livre ("Planos", "Implantação"...): é a organização
--                    quem decide as suas abas, não um enum do sistema.
--   tipo_cobranca    recorrente | unico | adicional
--   rotulo_clientes  como chamar quem compra ("redes", "unidades"); nulo = "clientes"

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS tipo_cobranca text,
  ADD COLUMN IF NOT EXISTS rotulo_clientes text;

ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_tipo_cobranca_check,
  ADD CONSTRAINT produtos_tipo_cobranca_check
    CHECK (tipo_cobranca IS NULL OR tipo_cobranca IN ('recorrente', 'unico', 'adicional'));

COMMENT ON COLUMN public.produtos.categoria IS
  'Aba da tela de Produtos. Texto livre; nulo = sem categoria.';
COMMENT ON COLUMN public.produtos.tipo_cobranca IS
  'recorrente (cobrado todo período), unico (cobrança única) ou adicional (módulo somado a um plano). Nulo = não classificado.';
COMMENT ON COLUMN public.produtos.rotulo_clientes IS
  'Como a tela chama quem compra este produto (ex.: redes). Nulo = clientes.';

CREATE INDEX IF NOT EXISTS produtos_org_categoria_idx ON public.produtos (org_id, categoria);
