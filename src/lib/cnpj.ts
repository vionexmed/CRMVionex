/*
 * CNPJ: máscara e validação pelos dígitos verificadores.
 *
 * Só o formato numérico (14 dígitos). O CNPJ alfanumérico que a Receita
 * introduz a partir de julho/2026 fica de fora de propósito: ainda não há
 * cliente com um, e aceitar letras sem o cálculo certo validaria lixo.
 */

export const soDigitos = (s: string) => s.replace(/\D/g, "");

/** "12.345.678/0001-95", progressivo: aceita o que foi digitado até agora. */
export function formatarCnpj(s: string): string {
  const d = soDigitos(s).slice(0, 14);
  let r = d.slice(0, 2);
  if (d.length > 2) r += `.${d.slice(2, 5)}`;
  if (d.length > 5) r += `.${d.slice(5, 8)}`;
  if (d.length > 8) r += `/${d.slice(8, 12)}`;
  if (d.length > 12) r += `-${d.slice(12, 14)}`;
  return r;
}

function digitoVerificador(base: string): number {
  // Pesos 2..9 da direita para a esquerda, reiniciando em 2.
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** 14 dígitos, não repetidos (00000000000000 passa na conta e não existe) e DVs certos. */
export function cnpjValido(s: string): boolean {
  const d = soDigitos(s);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const d1 = digitoVerificador(d.slice(0, 12));
  const d2 = digitoVerificador(d.slice(0, 12) + d1);
  return d[12] === String(d1) && d[13] === String(d2);
}
