/**
 * Quantos dias de calendário a atividade está atrasada.
 *
 * Conta por DIA e não por 24h: uma tarefa de ontem às 18h, vista hoje às 9h, é
 * "atrasada 1 dia" para quem lê -- 15 horas arredondariam para zero. Vencida
 * hoje mais cedo devolve 0, e a tela diz "atrasada hoje".
 */
export function diasDeAtraso(vencimento: string | Date, agora: Date = new Date()): number {
  const v = new Date(vencimento);
  const ini = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((ini(agora) - ini(v)) / 86_400_000));
}

export function textoDeAtraso(vencimento: string | Date, agora: Date = new Date()): string {
  const n = diasDeAtraso(vencimento, agora);
  if (n === 0) return "atrasada hoje";
  return `atrasada ${n} ${n === 1 ? "dia" : "dias"}`;
}
