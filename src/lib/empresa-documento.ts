/*
 * Os dados da empresa que aparecem como EMITENTE nos documentos (orçamento).
 * Moram em `organizations.settings.empresa` (json já existente): sem migração.
 */

export type DadosDaEmpresa = {
  razao_social: string; cnpj: string; endereco: string; telefone: string; email: string; site: string;
};

export const CAMPOS_DA_EMPRESA: (keyof DadosDaEmpresa)[] =
  ["razao_social", "cnpj", "endereco", "telefone", "email", "site"];

export const empresaVazia = (): DadosDaEmpresa =>
  ({ razao_social: "", cnpj: "", endereco: "", telefone: "", email: "", site: "" });

/** Lê `settings.empresa` tolerando json de qualquer formato: só string vira campo. */
export function empresaDeSettings(settings: unknown): DadosDaEmpresa {
  const bruto = (settings && typeof settings === "object"
    ? (settings as Record<string, unknown>).empresa : null) as Record<string, unknown> | null;
  const r = empresaVazia();
  if (bruto && typeof bruto === "object") {
    for (const k of CAMPOS_DA_EMPRESA) if (typeof bruto[k] === "string") r[k] = (bruto[k] as string).trim();
  }
  return r;
}
