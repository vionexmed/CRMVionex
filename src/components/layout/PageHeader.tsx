import { ReactNode } from "react";
import { formatarNumero, pluralizar } from "@/lib/formato";

/**
 * A contagem viva da tela — o número, separado do texto que o explica.
 *
 * Existia porque `description` carregava DUAS informações incompatíveis: nove
 * telas montavam contagem por template string (`${n} contatos cadastrados`) e
 * seis escreviam texto fixo, lido uma vez na vida. Iam para o mesmo slot, com o
 * mesmo tamanho e a mesma cor apagada — ou seja, o número, que muda toda hora e
 * é o dado, estava formatado como ajuda.
 *
 * O plural sai de `unidade` com "s", que resolve contato/contatos,
 * empresa/empresas e sequência/sequências. `plural` existe para o que não segue
 * a regra — "negócio no funil" vira "negócios no funil", não "negócio no funils".
 */
export type Contagem = {
  valor: number;
  /** No singular. */
  unidade: string;
  /** Só quando o plural não é `unidade + "s"`. */
  plural?: string;
};

interface PageHeaderProps {
  /**
   * O rótulo acima do título. Omitir é o caminho normal: sai de `grupoDaRota`,
   * a mesma lista que desenha a barra lateral. Passar à mão só para tela que
   * não é destino de navegação.
   */
  kicker?: string;
  title: string;
  /** Texto fixo que explica a tela. Nunca contagem — para isso existe `contagem`. */
  description?: string;
  contagem?: Contagem;
  actions?: ReactNode;
  meta?: ReactNode;
}

export function PageHeader({
  title,
  description,
  contagem,
  actions,
  meta,
}: PageHeaderProps) {
  const unidade = contagem
    ? pluralizar(contagem.valor, contagem.unidade, contagem.plural)
    : null;

  return (
    /*
     * PADRÃO DA PLATAFORMA: título de 24px em negrito, subtítulo cinza logo
     * abaixo e a ação primária à direita, no topo. Sem régua embaixo e sem
     * barra superior acima -- este é o cabeçalho da tela.
     *
     * A contagem não fica mais colada ao título como número solto: vira o
     * contador discreto "N resultados", o mesmo que a barra de ferramentas das
     * listas mostra ao lado da busca.
     */
    <header className="shrink-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="vx-titulo-tela break-words">{title}</h1>
            {contagem && (
              // `tabular-nums` porque o número muda sob os olhos -- sem largura
              // fixa de dígito, o total "pula" a cada filtro aplicado.
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatarNumero(contagem.valor)} {contagem.valor === 1 ? "resultado" : "resultados"}
                <span className="sr-only"> ({unidade})</span>
              </span>
            )}
          </div>
          {description && <p className="vx-subtitulo-tela">{description}</p>}
          {meta && <div className="mt-2">{meta}</div>}
        </div>

        {actions && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
