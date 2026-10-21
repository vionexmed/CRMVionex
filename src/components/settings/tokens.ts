/**
 * Lê os tokens de cor DIRETO do index.css (importado como texto), em vez de
 * copiá-los para uma tabela. Assim a página "Design system" não pode mostrar um
 * valor que o CSS já não tem: mudou o token, a página muda junto.
 */
import css from "@/index.css?raw";

export type Tokens = Record<string, string>;

/** Separado do import para ser testável com o CSS lido do disco. */
export function lerTokens(fonte: string): { claro: Tokens; escuro: Tokens } {
  const limpo = fonte.replace(/\/\*[\s\S]*?\*\//g, "");
  const bloco = (abertura: string): string => {
    const i = limpo.indexOf(abertura);
    if (i < 0) return "";
    const fim = limpo.indexOf("\n  }", i);
    return limpo.slice(i + abertura.length, fim < 0 ? undefined : fim);
  };
  const decl = (corpo: string): Tokens => {
    const out: Tokens = {};
    for (const m of corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
  };
  const claro = decl(bloco(":root {"));
  return { claro, escuro: { ...claro, ...decl(bloco(".dark {")) } };
}

const lidos = lerTokens(css);
export const TOKENS_CLARO = lidos.claro;
export const TOKENS_ESCURO = lidos.escuro;

/** "226 82% 55%" -> "#2F5BEA". Devolve null para o que não é tripla HSL. */
export function hslParaHex(valor: string | undefined): string | null {
  const m = valor?.match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) return null;
  const h = Number(m[1]), s = Number(m[2]) / 100, l = Number(m[3]) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
