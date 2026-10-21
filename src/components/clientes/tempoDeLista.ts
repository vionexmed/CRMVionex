/**
 * Texto de tempo da lista de Contatos, no formato curto do Visual 01.
 *
 * Não reaproveita `formatarTempoRelativo`: aquele devolve "há 2 horas" e usa o
 * `numeric: "auto"` do Intl ("anteontem"), e a referência pede "há 2 h",
 * "há 42 min", "ontem" e "hoje". Lista densa precisa de texto curto.
 */
const FUSO = "America/Sao_Paulo";

/** Chave AAAA-MM-DD do dia no fuso da clínica, para comparar dias de calendário. */
function diaDe(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Dias de calendário entre `d` e `agora` (positivo = no passado). */
function diasDeCalendario(d: Date, agora: Date): number {
  const a = Date.parse(`${diaDe(agora)}T00:00:00Z`);
  const b = Date.parse(`${diaDe(d)}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/** "há 42 min", "há 2 h", "hoje", "ontem", "há 8 dias". */
export function ultimoContatoTexto(d: Date, agora: Date = new Date()): string {
  const minutos = Math.floor((agora.getTime() - d.getTime()) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const dias = diasDeCalendario(d, agora);
  if (dias <= 0) {
    const horas = Math.floor(minutos / 60);
    return horas < 2 ? "hoje" : `há ${horas} h`;
  }
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

/** Dias de calendário sem contato (0 = hoje). */
export function diasSemContato(d: Date, agora: Date = new Date()): number {
  return Math.max(0, diasDeCalendario(d, agora));
}

/** "seg 09:00" -- dia da semana curto e hora, no fuso da clínica. */
export function diaEHoraCurtos(d: Date): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const pega = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dia = pega("weekday").replace(".", "");
  return `${dia} ${pega("hour")}:${pega("minute")}`;
}

/** Atraso da atividade em dias de calendário, no mínimo 1. */
export function diasDeAtraso(vencimento: Date, agora: Date = new Date()): number {
  return Math.max(1, diasDeCalendario(vencimento, agora));
}
