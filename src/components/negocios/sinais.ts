import type { AtividadeDoNegocio, DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";
import { aconteceuEm, ATIVIDADE_ROTULO } from "@/lib/atividade-tipos";
import { getContactOrigin } from "@/lib/contact-options";
import { formatarDataHoraCurta, pluralizar } from "@/lib/formato";

/**
 * Os sinais que o quadro de Negócios lê de cada negócio, num lugar só.
 *
 * Card, painel lateral, chips de filtro e faixa de indicadores perguntam as
 * mesmas coisas -- "qual a próxima atividade?", "está atrasada?", "há quanto
 * tempo ninguém mexe?". Respondidas em cada componente, as quatro respostas
 * divergiriam no primeiro ajuste, e o chip "Parados há 7+ dias" passaria a
 * filtrar um conjunto diferente do que o card pinta de vermelho.
 *
 * Tudo aqui é função pura sobre o que a listagem JÁ traz (`atividades` vem
 * embutida em `dealsApi.list`): nenhuma consulta nova, nenhum número sem fonte.
 * `agora` é parâmetro para o teste fixar o relógio.
 */

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

const DIA = 86_400_000;

/* ── Cor da etapa ──────────────────────────────────────────────────────────── */

/**
 * Lista literal, e não `bg-stage-${n}`: o Tailwind só gera a classe que
 * aparece inteira no fonte. Montada por template, ela sumiria do CSS em
 * silêncio.
 */
export const CLASSES_DE_ETAPA = [
  "bg-stage-1", "bg-stage-2", "bg-stage-3", "bg-stage-4", "bg-stage-5", "bg-stage-6",
] as const;

/**
 * A cor da etapa pela POSIÇÃO no funil, não pelo `pipeline_stages.color`.
 *
 * A escala vai da marca (entrada) ao verde (fechamento). Distribuída pela
 * posição relativa, a primeira etapa é sempre a marca e a última é sempre o
 * verde -- num funil de 4 ou de 9 etapas. Prender ao índice cru pintaria
 * todas as etapas depois da sexta da mesma cor.
 */
export function corDaEtapa(indice: number, total: number): string {
  if (total <= 1) return CLASSES_DE_ETAPA[0];
  const passo = Math.round((indice / (total - 1)) * (CLASSES_DE_ETAPA.length - 1));
  return CLASSES_DE_ETAPA[Math.min(CLASSES_DE_ETAPA.length - 1, Math.max(0, passo))];
}

/** Cópia ordenada por `order`: o array de entrada vem de um useMemo de fora. */
export function etapasEmOrdem(etapas: readonly Stage[]): Stage[] {
  return [...etapas].sort((a, b) => a.order - b.order);
}

/* ── Tempo ─────────────────────────────────────────────────────────────────── */

/** Dias de CALENDÁRIO entre dois instantes: "ontem às 23h" é 1 dia, não 0. */
function diasDeCalendario(de: number, ate: number): number {
  const a = new Date(de); a.setHours(0, 0, 0, 0);
  const b = new Date(ate); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DIA);
}

/* ── Próxima atividade ─────────────────────────────────────────────────────── */

export type ProximaAtividade = {
  atividade: AtividadeDoNegocio;
  atrasada: boolean;
  /** Dias de calendário desde o prazo. 0 = venceu hoje. */
  diasDeAtraso: number;
};

/**
 * A atividade pendente que pede ação primeiro: a de prazo MAIS ANTIGO.
 *
 * Pendente é `completed_at IS NULL` com `due_date` -- a mesma regra da tela de
 * Atividades. Sem prazo não há "próxima": é registro solto, e mostrá-lo como
 * agenda inventaria um compromisso que ninguém marcou.
 *
 * O prazo mais antigo e não o mais próximo do futuro: se há uma reunião
 * atrasada e uma ligação amanhã, é a atrasada que o card precisa gritar.
 */
export function proximaAtividade(
  atividades: readonly AtividadeDoNegocio[] | null | undefined,
  agora: number = Date.now(),
): ProximaAtividade | null {
  let escolhida: AtividadeDoNegocio | null = null;
  let prazoEscolhido = Infinity;
  for (const a of atividades ?? []) {
    if (a.completed_at || !a.due_date) continue;
    const prazo = Date.parse(a.due_date);
    if (Number.isNaN(prazo)) continue;
    if (prazo < prazoEscolhido) { escolhida = a; prazoEscolhido = prazo; }
  }
  if (!escolhida) return null;
  const atrasada = prazoEscolhido < agora;
  return {
    atividade: escolhida,
    atrasada,
    diasDeAtraso: atrasada ? Math.max(0, diasDeCalendario(prazoEscolhido, agora)) : 0,
  };
}

const diaDaSemanaEHora = new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
const diaDaSemanaDataHora = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

/** "seg, 09:00" para os próximos 6 dias; "12 set, 14:30" depois disso. */
export function quandoCurto(iso: string, agora: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const dias = diasDeCalendario(agora, t);
  if (dias >= 0 && dias < 7) return diaDaSemanaEHora.format(t).replace(".", "");
  return formatarDataHoraCurta(iso);
}

/** "sex, 9 out, 15:00" -- para dizer QUANDO era a atividade que venceu. */
export function quandoCompleto(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "—" : diaDaSemanaDataHora.format(t).replace(/\./g, "");
}

/** "Ligação seg, 09:00" ou "Reunião atrasada 2 dias". */
export function rotuloDaProxima(p: ProximaAtividade, agora: number = Date.now()): string {
  const tipo = ATIVIDADE_ROTULO[p.atividade.type];
  if (!p.atrasada) return `${tipo} ${quandoCurto(p.atividade.due_date!, agora)}`;
  if (p.diasDeAtraso === 0) return `${tipo} atrasada`;
  return `${tipo} atrasada ${p.diasDeAtraso} ${pluralizar(p.diasDeAtraso, "dia")}`;
}

/* ── Parado ────────────────────────────────────────────────────────────────── */

/**
 * Dias desde o último movimento do negócio.
 *
 * Movimento = qualquer atividade registrada (pela conclusão, ou pela criação
 * nas linhas antigas -- `aconteceuEm`) ou a criação do próprio negócio. Mudar
 * de etapa NÃO conta: o banco não guarda quando aconteceu, e `updated_at`
 * também anda quando alguém só corrige o valor -- contá-lo faria um negócio
 * esquecido parecer vivo por causa de uma edição de cadastro.
 */
export function diasParado(deal: Pick<DealWithRelations, "created_at" | "atividades">, agora: number = Date.now()): number {
  let ultimo = deal.created_at ? Date.parse(deal.created_at) : 0;
  for (const a of deal.atividades ?? []) ultimo = Math.max(ultimo, aconteceuEm(a));
  if (!ultimo || Number.isNaN(ultimo)) return 0;
  return Math.max(0, Math.floor((agora - ultimo) / DIA));
}

/* ── Identidade ────────────────────────────────────────────────────────────── */

export type Identidade = {
  /** O nome das iniciais: a empresa quando há, senão a pessoa. */
  nomeIniciais: string;
  forma: "pessoa" | "empresa";
  /** Nome da pessoa, ou null quando ele JÁ É o título (ver o card). */
  nomeContato: string | null;
  /** `metadata.source` do contato, no rótulo da tela de Contatos. */
  origem: string | null;
};

export function identidadeDoNegocio(deal: DealWithRelations): Identidade {
  const nome = deal.contact
    ? `${deal.contact.first_name} ${deal.contact.last_name || ""}`.trim()
    : null;
  return {
    nomeIniciais: deal.company?.name || nome || deal.title,
    forma: deal.company ? "empresa" : "pessoa",
    nomeContato: nome && nome !== deal.title ? nome : null,
    origem: deal.contact
      ? getContactOrigin(deal.contact.metadata as Record<string, unknown> | null).label
      : null,
  };
}

/* ── Filtros de sinal ──────────────────────────────────────────────────────── */

export type FiltroDeSinal = {
  /** Só negócios com atividade pendente vencida. */
  atrasada: boolean;
  /** Só negócios parados há N+ dias. null = desligado. */
  paradosHa: number | null;
};

export function filtrarPorSinal<T extends DealWithRelations>(
  deals: readonly T[],
  filtro: FiltroDeSinal,
  agora: number = Date.now(),
): T[] {
  if (!filtro.atrasada && filtro.paradosHa === null) return deals as T[];
  return deals.filter((d) => {
    if (filtro.atrasada && !proximaAtividade(d.atividades, agora)?.atrasada) return false;
    if (filtro.paradosHa !== null && diasParado(d, agora) < filtro.paradosHa) return false;
    return true;
  });
}

/* ── Resumo do funil (faixa de indicadores) ────────────────────────────────── */

export type ResumoDoFunil = {
  aberto: {
    total: number;
    quantidade: number;
    porEtapa: { id: string; nome: string; total: number; classe: string }[];
  };
  /** null quando NENHUMA etapa tem probabilidade: o card some em vez de dizer R$ 0. */
  ponderada: number | null;
  ganhosNoMes: { total: number; quantidade: number };
  /** null sem nenhum negócio encerrado: 0% sugeriria que tudo foi perdido. */
  taxa: { ganhos: number; encerrados: number; percentual: number } | null;
  parados14: number;
};

/**
 * Os quatro números do topo do funil, a partir do que o quadro já carregou.
 *
 * GANHOS NO MÊS: `status = 'won'` E `close_date` no mês corrente. O banco não
 * guarda o instante da vitória (não há `won_at`), e `close_date` é o mesmo
 * critério que as funções do painel usam para "vendas" (`d.status = 'won' AND
 * d.close_date ...` em sdr_metrics) -- seguir outro aqui faria o funil e o
 * painel discordarem do mesmo mês. A conclusão é o `status`; a data é a única
 * que existe.
 *
 * TAXA DE GANHO: sobre os encerrados que o quadro tem (respeita os filtros),
 * sem janela de tempo -- negócio perdido raramente ganha `close_date`, e cortar
 * por ela tiraria quase todos os perdidos da conta, inflando a taxa.
 */
export function resumirFunil({
  abertos, ganhos, perdidos, etapas, agora = Date.now(),
}: {
  abertos: readonly DealWithRelations[];
  ganhos: readonly DealWithRelations[];
  perdidos: readonly DealWithRelations[];
  etapas: readonly Stage[];
  agora?: number;
}): ResumoDoFunil {
  const ordenadas = etapasEmOrdem(etapas);
  const valor = (d: DealWithRelations) => Number(d.value) || 0;

  const somaPorEtapa = new Map<string, number>();
  let totalAberto = 0;
  for (const d of abertos) {
    totalAberto += valor(d);
    if (d.stage_id) somaPorEtapa.set(d.stage_id, (somaPorEtapa.get(d.stage_id) ?? 0) + valor(d));
  }

  const temProbabilidade = ordenadas.some((e) => (Number(e.win_probability) || 0) > 0);
  let ponderada: number | null = null;
  if (temProbabilidade) {
    const chance = new Map(ordenadas.map((e) => [e.id, (Number(e.win_probability) || 0) / 100]));
    ponderada = abertos.reduce((s, d) => s + valor(d) * (chance.get(d.stage_id ?? "") ?? 0), 0);
  }

  const hoje = new Date(agora);
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const doMes = ganhos.filter((d) => d.close_date?.slice(0, 7) === mes);

  const encerrados = ganhos.length + perdidos.length;

  return {
    aberto: {
      total: totalAberto,
      quantidade: abertos.length,
      porEtapa: ordenadas.map((e, i) => ({
        id: e.id, nome: e.name, total: somaPorEtapa.get(e.id) ?? 0, classe: corDaEtapa(i, ordenadas.length),
      })),
    },
    ponderada,
    ganhosNoMes: { total: doMes.reduce((s, d) => s + valor(d), 0), quantidade: doMes.length },
    taxa: encerrados > 0
      ? { ganhos: ganhos.length, encerrados, percentual: Math.round((ganhos.length / encerrados) * 100) }
      : null,
    parados14: abertos.filter((d) => diasParado(d, agora) >= 14).length,
  };
}
