/**
 * Os rótulos de período do painel: "1–21 out", "vs. setembro", "Outubro".
 *
 * Tudo derivado de `getSdrRanges`, o MESMO intervalo que as consultas usam. Um
 * rótulo calculado por conta própria poderia dizer "1–21 out" enquanto a
 * consulta pegava outra janela -- e o número embaixo dele estaria certo para um
 * período que a tela não nomeia.
 *
 * Sem dependência de React nem de Supabase de propósito: dá para testar com
 * `agora` fixo.
 */
import { getSdrRanges, type SdrPeriod } from "@/hooks/useSdrMetrics";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIA = 86_400_000;

/** "2026-10-07" como data LOCAL. `new Date("2026-10-07")` é meia-noite UTC, que
 *  no Brasil cai no dia 6 às 21h -- o gráfico rotularia todo ponto um dia antes. */
export function dataDoDia(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

/** "7 out" */
export function diaCurto(d: Date): string {
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
}

/** "qua, 7 out" */
export function diaComSemana(d: Date): string {
  return `${SEMANA[d.getDay()]}, ${diaCurto(d)}`;
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type RotulosDoPeriodo = {
  /** "1–21 out", "1 jul – 21 set". null em "Todo o período". */
  intervalo: string | null;
  /** "1 a 21 de outubro", para o título do gráfico. */
  intervaloPorExtenso: string | null;
  /** "setembro", "ontem", "semana anterior". null sem comparação. */
  comparacao: string | null;
  /** Legenda das duas linhas: "Outubro" / "Setembro". */
  legendaAtual: string;
  legendaAnterior: string | null;
  /** Dias do período inteiro; null em "Todo o período". */
  diasNoPeriodo: number | null;
  /** Dias já decorridos, contando hoje. Igual a `diasNoPeriodo` se acabou. */
  diasDecorridos: number | null;
  /** O período ainda está correndo -- só aí "projeção" faz sentido. */
  emAndamento: boolean;
  /** "mês", "semana"… para "Projeção do mês". */
  nomeDoPeriodo: string;
};

export function rotulosDoPeriodo(period: SdrPeriod, agora: Date = new Date()): RotulosDoPeriodo {
  const { current, previous } = getSdrRanges(period);
  const nomeDoPeriodo = {
    today: "dia", this_week: "semana", this_month: "mês", last_month: "mês",
    this_quarter: "trimestre", this_year: "ano", all: "período",
  }[period];

  if (!current.start || !current.end) {
    return {
      intervalo: null, intervaloPorExtenso: "últimos 30 dias", comparacao: null,
      legendaAtual: "Últimos 30 dias", legendaAnterior: null,
      diasNoPeriodo: null, diasDecorridos: null, emAndamento: false, nomeDoPeriodo,
    };
  }

  const inicio = current.start;
  const ultimoDia = new Date(current.end.getTime() - DIA);
  const emAndamento = agora < current.end;
  const fimVisivel = emAndamento && agora < ultimoDia ? agora : ultimoDia;
  const diasNoPeriodo = Math.round((current.end.getTime() - inicio.getTime()) / DIA);
  const diasDecorridos = Math.min(
    diasNoPeriodo,
    Math.max(1, Math.floor((fimVisivel.getTime() - inicio.getTime()) / DIA) + 1),
  );

  const mesmoMes = inicio.getMonth() === fimVisivel.getMonth() && inicio.getFullYear() === fimVisivel.getFullYear();
  const intervalo = inicio.toDateString() === fimVisivel.toDateString()
    ? diaCurto(inicio)
    : mesmoMes
      ? `${inicio.getDate()}–${diaCurto(fimVisivel)}`
      : `${diaCurto(inicio)} – ${diaCurto(fimVisivel)}`;
  const intervaloPorExtenso = mesmoMes
    ? inicio.getDate() === fimVisivel.getDate()
      ? `${inicio.getDate()} de ${MESES[inicio.getMonth()]}`
      : `${inicio.getDate()} a ${fimVisivel.getDate()} de ${MESES[inicio.getMonth()]}`
    : `${diaCurto(inicio)} a ${diaCurto(fimVisivel)}`;

  const mensal = period === "this_month" || period === "last_month";
  const comparacao = !previous
    ? null
    : mensal
      ? MESES[previous.start!.getMonth()]
      : { today: "ontem", this_week: "semana anterior", this_quarter: "trimestre anterior", this_year: String(previous.start!.getFullYear()) }[period as "today" | "this_week" | "this_quarter" | "this_year"];

  return {
    intervalo,
    intervaloPorExtenso,
    comparacao,
    legendaAtual: mensal ? capitalizar(MESES[inicio.getMonth()]) : period === "this_year" ? String(inicio.getFullYear()) : "Este período",
    legendaAnterior: comparacao ? capitalizar(comparacao) : null,
    diasNoPeriodo,
    diasDecorridos,
    emAndamento,
    nomeDoPeriodo,
  };
}
