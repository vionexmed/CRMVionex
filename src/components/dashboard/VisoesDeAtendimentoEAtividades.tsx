/**
 * Visões "Atendimento" e "Atividades" do painel. Só reaproveitam dados que o
 * painel já tem (sdr_metrics, sdr_series, mensagens por hora, atividades): nada
 * aqui é métrica nova sem fonte.
 */
import { MessagesSquare, Timer, Hourglass, Reply, CheckCheck, TriangleAlert, CalendarClock, CircleCheck, CalendarCheck, Send } from "lucide-react";
import { CartaoDeGrafico, GradeDeIndicadores, CartaoDeIndicador } from "@/components/padrao";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarNumero } from "@/lib/formato";
import { ATIVIDADE_ROTULO, type ActivityType } from "@/lib/atividade-tipos";
import { GraficoEvolucao } from "./GraficoEvolucao";
import { AtendimentoAgora, Pendencias } from "./PainelLateral";
import { RankingEmBarras } from "./RoscaPorAtendente";
import { IndicadorDeMetrica, type DadosDoPainel } from "./dados-do-painel";
import { useAtividadesAtrasadas } from "./usePendencias";
import { useAtividadesConcluidas, useAtividadesParaHoje } from "./useAtividadesDoPainel";

export function VisaoAtendimento({ d }: { d: DadosDoPainel }) {
  const r = d.rotulos;
  // `respostas` na série são as mensagens RECEBIDAS por dia.
  const pontos = (d.charts?.serie ?? []).filter((p) => p.dia.slice(0, 10) <= d.hoje).map((p) => ({ dia: p.dia, valor: p.respostas }));
  const anterior = d.serieAnterior && d.comparacao !== "nenhuma" ? d.serieAnterior.map((p) => p.respostas) : null;
  return (
    <>
      <GradeDeIndicadores>
        <IndicadorDeMetrica chave="tempoRespostaMin" rotulo="Tempo de resposta" d={d} icone={<Timer />} />
        <IndicadorDeMetrica chave="aguardandoHumano" rotulo="Aguardando" d={d} icone={<Hourglass />} />
        <IndicadorDeMetrica chave="conversasIniciadas" d={d} icone={<MessagesSquare />} />
        <IndicadorDeMetrica chave="taxaResposta" d={d} icone={<Reply />} />
        <IndicadorDeMetrica chave="taxaEntrega" d={d} icone={<CheckCheck />} />
      </GradeDeIndicadores>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CartaoDeGrafico titulo="Mensagens por dia" subtitulo="Mensagens recebidas no período">
          {d.carregandoCharts ? <Skeleton className="h-48" /> : (
            <GraficoEvolucao
              embutido
              titulo="Mensagens recebidas por dia"
              unidade={{ singular: "mensagem", plural: "mensagens" }}
              pontos={pontos}
              anterior={anterior}
              legendaAtual={r.legendaAtual}
              legendaAnterior={r.legendaAnterior}
              rotuloComparacao={r.comparacao}
              projecao={null}
            />
          )}
        </CartaoDeGrafico>
        <AtendimentoAgora
          tempoResposta={d.metrics?.tempoRespostaMin}
          aguardando={d.metrics?.aguardandoHumano?.value ?? null}
          carregando={d.carregando}
          period={d.period}
        />
      </div>
    </>
  );
}

export function VisaoAtividades({ d }: { d: DadosDoPainel }) {
  const atrasadas = useAtividadesAtrasadas();
  const hoje = useAtividadesParaHoje();
  const concluidas = useAtividadesConcluidas(d.period);

  const numero = (q: { isLoading: boolean; data?: number }) =>
    q.isLoading ? <span className="inline-block h-6 w-20 animate-pulse rounded bg-muted align-middle" /> : q.data === undefined ? "—" : formatarNumero(q.data);
  const porTipo = concluidas.data?.porTipo
    ? (Object.entries(concluidas.data.porTipo) as [ActivityType, number][])
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => ({ nome: ATIVIDADE_ROTULO[t], valor: n }))
    : [];

  return (
    <>
      <GradeDeIndicadores>
        <CartaoDeIndicador rotulo="Atrasadas" valor={numero({ isLoading: atrasadas.isLoading, data: atrasadas.data?.total })} subtexto="prazo vencido" icone={<TriangleAlert />} tom="perigo" />
        <CartaoDeIndicador rotulo="Para hoje" valor={numero(hoje)} subtexto="prazo hoje, ainda abertas" icone={<CalendarClock />} />
        <CartaoDeIndicador rotulo="Concluídas" valor={numero({ isLoading: concluidas.isLoading, data: concluidas.data?.total })} subtexto="no período, pela conclusão" icone={<CircleCheck />} tom="sucesso" />
        <IndicadorDeMetrica chave="reunioes" d={d} icone={<CalendarCheck />} />
        <IndicadorDeMetrica chave="abordagens" d={d} icone={<Send />} />
      </GradeDeIndicadores>
      <div className="grid gap-4 lg:grid-cols-2">
        <CartaoDeGrafico
          titulo="Concluídas por tipo"
          subtitulo="Atividades concluídas no período"
          vazio={!concluidas.isLoading && porTipo.length === 0}
        >
          {concluidas.isLoading ? <Skeleton className="h-48" /> : <RankingEmBarras itens={porTipo} unidade={["atividade", "atividades"]} />}
        </CartaoDeGrafico>
        <Pendencias aguardando={d.metrics?.aguardandoHumano?.value ?? null} carregandoMetricas={d.carregando} />
      </div>
    </>
  );
}
