import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Valor de aba aceito: o da URL se for conhecido, senão o padrão.
 *
 * Separado do hook para ser testável sem router. A lista de válidas existe
 * porque `?aba=qualquer-coisa` chegaria ao Radix como valor sem conteúdo
 * correspondente: a barra ficaria sem aba ativa e o corpo, em branco. Em
 * Configurações isso também protege o acesso -- um funcionário que cole
 * `?aba=billing` cai no padrão em vez de numa aba que ele não vê.
 */
export function resolverAba<T extends string>(
  valor: string | null,
  validas: readonly T[],
  padrao: T,
): T {
  return valor !== null && (validas as readonly string[]).includes(valor) ? (valor as T) : padrao;
}

/**
 * A aba ativa mora na URL, não em `useState`/`defaultValue`.
 *
 * Com `Tabs defaultValue`, F5 devolvia a primeira aba e não dava para mandar o
 * link de "Integrações > Webhooks" a um colega. `replace: true` porque trocar de
 * aba não é navegação: sem ele, o botão Voltar percorreria cada aba visitada
 * antes de sair da página.
 *
 * A aba padrão NÃO é escrita na URL (fica `/settings`, não `/settings?aba=general`),
 * e os demais parâmetros da query são preservados.
 */
export function useAbaNaUrl<T extends string>(
  param: string = "aba",
  padrao: T,
  validas: readonly T[],
): [T, (aba: string) => void] {
  const [params, setParams] = useSearchParams();
  const aba = resolverAba(params.get(param), validas, padrao);

  const trocar = useCallback(
    (nova: string) => {
      setParams(
        (atual) => {
          const proximo = new URLSearchParams(atual);
          if (nova === padrao) proximo.delete(param);
          else proximo.set(param, nova);
          return proximo;
        },
        { replace: true },
      );
    },
    [param, padrao, setParams],
  );

  return [aba, trocar];
}
