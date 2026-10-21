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
     * VISUAL 01: título grande com a contagem AO LADO, em cinza -- "Contatos
     * 1.284". O rótulo da área saiu daqui porque a trilha da barra superior já
     * diz onde a pessoa está; repetir em cima do título era a mesma informação
     * duas vezes no mesmo palmo de tela. Sem régua embaixo: quem vem logo abaixo
     * (abas de visão, filtros) já desenha a própria linha.
     */
    <header className="shrink-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="vx-titulo-tela break-words">
            {title}
            {contagem && (
              // `tabular-nums` porque o número muda sob os olhos -- sem largura
              // fixa de dígito, o total "pula" a cada filtro aplicado.
              <span className="ml-2.5 align-baseline text-base font-medium tabular-nums text-muted-foreground">
                {formatarNumero(contagem.valor)}
                <span className="sr-only"> {unidade}</span>
              </span>
            )}
          </h1>
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
