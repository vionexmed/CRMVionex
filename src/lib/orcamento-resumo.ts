import { estadoDoOrcamento, totaisDoOrcamento } from "@/lib/orcamento-calculo";
import { nomeDoContato } from "@/lib/contato-formato";
import type { OrcamentoComRelacoes } from "@/lib/api/orcamentos";

/**
 * O PostgREST corta em 1000 linhas sem avisar (ver CLAUDE.md), e `orcamentosApi.list`
 * não pagina. Com 1000 linhas na mão, o resumo pode estar incompleto -- e um
 * total que parece exato mas está cortado é pior que nenhum.
 */
export const LIMITE_DA_LISTA = 1000;

/** Vencer em até 2 dias já é "em breve" para quem espera resposta. */
export const DIAS_DE_AVISO = 2;

export type ValorPorMoeda = Record<string, number>;

export type ResumoDeOrcamentos = {
  emAberto: { quantidade: number; valor: ValorPorMoeda };
  aprovadoNoMes: { quantidade: number; valor: ValorPorMoeda };
  /** null quando ninguém decidiu ainda: 0% seria mentira, não há base. */
  taxaDeAprovacao: number | null;
  decididos: number;
  /** Enviados no mês corrente, contados por `enviado_em` (a intenção de rascunho não entra). */
  enviadosNoMes: { quantidade: number; valor: ValorPorMoeda };
  /**
   * Dos enviados NO MÊS, quantos já foram aprovados; null sem enviado.
   *
   * Por coorte, e não "aprovados no mês ÷ enviados no mês": nessa conta um
   * aprovado em outubro que foi enviado em setembro entrava no numerador e não
   * no denominador, e a taxa podia passar de 100%.
   */
  aceitosSobreEnviados: number | null;
  /** Enviados ainda válidos que vencem em até `DIAS_DE_AVISO` dias. */
  expiramEmBreve: { quantidade: number; valor: ValorPorMoeda };
  possivelmenteCortado: boolean;
};

/** Total do orçamento, recalculado dos itens -- a mesma conta da linha da lista. */
export function totalDe(o: OrcamentoComRelacoes): number {
  const itens = (o.itens ?? []).map((i) => ({
    preco_unit: Number(i.preco_unit),
    quantidade: Number(i.quantidade),
    desconto: Number(i.desconto),
  }));
  return totaisDoOrcamento(itens, Number(o.desconto) || 0).total;
}

function mesmoMes(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Dias inteiros até o fim da validade: 0 = vence hoje, 1 = amanhã. null sem
 * data, e negativo quando já passou (quem chama decide; `estadoDoOrcamento`
 * já trata o vencido).
 */
export function diasParaVencer(validoAte: string | null, agora: Date = new Date()): number | null {
  if (!validoAte) return null;
  const alvo = new Date(`${validoAte}T00:00:00`);
  if (isNaN(alvo.getTime())) return null;
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

function somar(acc: ValorPorMoeda, moeda: string, valor: number) {
  acc[moeda] = (acc[moeda] ?? 0) + valor;
}

/**
 * Moedas ficam separadas: somar BRL com USD num número só seria um total sem
 * unidade. O "mês" do aprovado conta pela DECISÃO (`decidido_em`), não pela
 * criação -- um orçamento de março aprovado em abril é receita de abril.
 */
export function resumirOrcamentos(
  lista: OrcamentoComRelacoes[],
  agora: Date = new Date(),
): ResumoDeOrcamentos {
  const emAberto = { quantidade: 0, valor: {} as ValorPorMoeda };
  const aprovadoNoMes = { quantidade: 0, valor: {} as ValorPorMoeda };
  const enviadosNoMes = { quantidade: 0, valor: {} as ValorPorMoeda };
  const expiramEmBreve = { quantidade: 0, valor: {} as ValorPorMoeda };
  let aprovados = 0;
  let recusados = 0;
  let aprovadosDosEnviadosNoMes = 0;

  for (const o of lista) {
    const estado = estadoDoOrcamento(o);
    if (o.enviado_em && mesmoMes(new Date(o.enviado_em), agora)) {
      enviadosNoMes.quantidade++;
      somar(enviadosNoMes.valor, o.moeda, totalDe(o));
      if (estado === "aprovado") aprovadosDosEnviadosNoMes++;
    }
    if (estado === "enviado") {
      emAberto.quantidade++;
      somar(emAberto.valor, o.moeda, totalDe(o));
      const dias = diasParaVencer(o.valido_ate, agora);
      if (dias !== null && dias <= DIAS_DE_AVISO) {
        expiramEmBreve.quantidade++;
        somar(expiramEmBreve.valor, o.moeda, totalDe(o));
      }
    } else if (estado === "aprovado") {
      aprovados++;
      const quando = new Date(o.decidido_em ?? o.updated_at);
      if (mesmoMes(quando, agora)) {
        aprovadoNoMes.quantidade++;
        somar(aprovadoNoMes.valor, o.moeda, totalDe(o));
      }
    } else if (estado === "recusado") {
      recusados++;
    }
  }

  const decididos = aprovados + recusados;
  return {
    emAberto,
    aprovadoNoMes,
    taxaDeAprovacao: decididos === 0 ? null : aprovados / decididos,
    decididos,
    enviadosNoMes,
    aceitosSobreEnviados:
      enviadosNoMes.quantidade === 0 ? null : aprovadosDosEnviadosNoMes / enviadosNoMes.quantidade,
    expiramEmBreve,
    possivelmenteCortado: lista.length >= LIMITE_DA_LISTA,
  };
}

/** Ordenação da lista: `data` = mais recentes primeiro, `valor` = maiores primeiro. */
export type OrdemDeOrcamento = "data" | "valor";

export function ordenarOrcamentos(
  lista: OrcamentoComRelacoes[],
  ordem: OrdemDeOrcamento,
): OrcamentoComRelacoes[] {
  const copia = lista.slice();
  if (ordem === "valor") {
    return copia.sort((a, b) => totalDe(b) - totalDe(a) || b.numero - a.numero);
  }
  // `numero` é sequencial por criação; desempata `created_at` igual.
  return copia.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.numero - a.numero);
}

/** "ORC-0142": o número sequencial no formato que se fala ao telefone. */
export function codigoDoOrcamento(numero: number): string {
  return `ORC-${String(numero).padStart(4, "0")}`;
}

/** Nome que identifica o cliente na linha: a empresa, e na falta dela a pessoa. */
export function clienteDoOrcamento(o: OrcamentoComRelacoes): { nome: string; apoio: string } {
  const pessoa = o.contact ? nomeDoContato(o.contact.first_name, o.contact.last_name) : "";
  const empresa = o.company?.name ?? "";
  const nome = empresa || pessoa || "Sem contato";
  // O subtítulo prefere o título do orçamento ("Plano Pro · 3 unidades"); sem
  // ele, a pessoa de contato quando o nome da linha já é a empresa.
  const apoio = o.titulo || (empresa ? pessoa : "") || "—";
  return { nome, apoio };
}

