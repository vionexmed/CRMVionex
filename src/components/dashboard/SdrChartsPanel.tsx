/**
 * O arranjo da visão geral do painel — e o estado de carregamento dele.
 *
 * Coluna principal larga, lateral estreita, como no Visual 01:
 *
 *   principal  a faixa de números e a métrica escolhida dia a dia; abaixo, o
 *              funil e o desempenho por pessoa -- o que ACONTECEU
 *   lateral    o que espera ação agora; abaixo, de onde os leads vieram
 *
 * `2fr / 1fr` com `minmax(0, …)`: as colunas podem encolher abaixo do
 * conteúdo, que é o que impede um rótulo longo de empurrar a grade.
 *
 * A GRADE É UMA SÓ, e as posições são explícitas. Eram duas pilhas
 * independentes, e a fileira de baixo começava em alturas diferentes nas duas
 * colunas -- o olho lê isso como cartão torto. A ORDEM DO DOM continua sendo a
 * de leitura no celular (números, pendências, funil, canais, pessoas), e a
 * posição em `lg` vem de `col-start`/`row-start`.
 *
 * SEM `items-start`: esticando, os dois cartões de uma fileira terminam juntos.
 */
import type { ComponentProps, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GraficoEvolucao } from "./GraficoEvolucao";
import { GraficoFunil, GraficoCanais, GraficoPessoas } from "./SdrCharts";
import type { SdrCharts } from "@/hooks/useSdrCharts";

const AREA = {
  evolucao: "lg:col-start-1 lg:row-start-1",
  lateral: "lg:col-start-2 lg:row-start-1",
  funil: "lg:col-start-1 lg:row-start-2",
  canais: "lg:col-start-2 lg:row-start-2",
  pessoas: "lg:col-start-1 lg:row-start-3",
} as const;

export default function SdrChartsPanel({
  charts,
  carregando,
  faixa,
  evolucao,
  semSerie,
  lateral,
}: {
  charts: SdrCharts | undefined;
  carregando: boolean;
  /** A faixa de números, que abre o cartão principal. */
  faixa: ReactNode;
  /** A série da métrica escolhida; null quando ela não tem série diária. */
  evolucao: ComponentProps<typeof GraficoEvolucao> | null;
  /** O que aparece no lugar do gráfico quando `evolucao` é null. */
  semSerie: ReactNode;
  lateral: ReactNode;
}) {
  if (carregando) {
    return (
      // O esqueleto usa a MESMA grade: com pilha aqui e grade depois, a tela
      // saltava de um arranjo para outro ao terminar de carregar.
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className={cn("min-w-0 overflow-hidden", AREA.evolucao)}>
          {faixa}
          <div className="vx-respiro" aria-label="Carregando gráfico"><Skeleton className="h-[240px]" /></div>
        </Card>
        <div className={cn("flex min-w-0 flex-col gap-4", AREA.lateral)}>{lateral}</div>
        <Skeleton className={cn("h-[260px] rounded-lg", AREA.funil)} />
        <Skeleton className={cn("h-[260px] rounded-lg", AREA.canais)} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card className={cn("min-w-0 overflow-hidden", AREA.evolucao)}>
        {faixa}
        {evolucao ? <GraficoEvolucao {...evolucao} /> : semSerie}
      </Card>

      <div className={cn("flex min-w-0 flex-col gap-4", AREA.lateral)}>{lateral}</div>

      <GraficoFunil dados={charts?.funil ?? []} className={AREA.funil} />

      <GraficoCanais dados={charts?.canais ?? []} className={AREA.canais} />

      {/* Visível para toda a equipe: os eventos que compõem o número de cada
          pessoa já estão à vista dela. `pessoas` null é falha de consulta, e a
          falha é dita no cartão em vez de o cartão sumir. */}
      <GraficoPessoas
        dados={charts?.pessoas ?? []}
        falhou={charts?.pessoas === null}
        className={cn(AREA.pessoas, "lg:col-span-2")}
      />
    </div>
  );
}
