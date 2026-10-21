import { useCallback, useEffect, useState } from "react";

/**
 * Preferências da lista de Contatos guardadas no navegador, POR ORGANIZAÇÃO.
 *
 * Por organização porque quem atende duas clínicas não quer as visões salvas de
 * uma aparecendo na outra -- o filtro "Responsável: Ana" de uma não significa
 * nada na outra. `localStorage` pode lançar (janela privada, dados bloqueados),
 * então toda leitura e escrita é protegida e a tela funciona sem ele.
 */

function ler<T>(chave: string, padrao: T, valido: (v: unknown) => v is T): T {
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return padrao;
    const v: unknown = JSON.parse(bruto);
    return valido(v) ? v : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try { window.localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: vale só nesta sessão */ }
}

function useArmazenado<T>(chave: string | null, padrao: T, valido: (v: unknown) => v is T) {
  const [valor, setValor] = useState<T>(() => (chave ? ler(chave, padrao, valido) : padrao));
  // Trocou de organização: relê, em vez de carregar a preferência da anterior.
  useEffect(() => { setValor(chave ? ler(chave, padrao, valido) : padrao); }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const salvar = useCallback((novo: T | ((atual: T) => T)) => {
    setValor((atual) => {
      const proximo = typeof novo === "function" ? (novo as (a: T) => T)(atual) : novo;
      if (chave) gravar(chave, proximo);
      return proximo;
    });
  }, [chave]);
  return [valor, salvar] as const;
}

/* ── Colunas visíveis ──────────────────────────────────────────────────────── */

/** As colunas que o usuário pode esconder. Nome fica fixo: sem ele a linha não tem dono. */
export const COLUNAS_ESCONDIVEIS = [
  { id: "estagio", rotulo: "Estágio" },
  { id: "empresa", rotulo: "Empresa" },
  { id: "origem", rotulo: "Origem" },
  { id: "pontuacao", rotulo: "Pontuação" },
  { id: "responsavel", rotulo: "Responsável" },
  { id: "ultimoContato", rotulo: "Último contato" },
  { id: "proximaAtividade", rotulo: "Próxima atividade" },
] as const;
export type ColunaId = (typeof COLUNAS_ESCONDIVEIS)[number]["id"];

const TODAS_AS_COLUNAS: ColunaId[] = COLUNAS_ESCONDIVEIS.map((c) => c.id);
const colunasValidas = (v: unknown): v is ColunaId[] =>
  Array.isArray(v) && v.every((x) => TODAS_AS_COLUNAS.includes(x as ColunaId));

/** Lista das colunas VISÍVEIS. Guardar as escondidas faria coluna nova nascer invisível. */
export function useColunasVisiveis(orgId: string | null | undefined) {
  const [escondidas, setEscondidas] = useArmazenado<ColunaId[]>(
    orgId ? `vx:contatos:colunas-escondidas:${orgId}` : null, [], colunasValidas,
  );
  const visivel = (id: ColunaId) => !escondidas.includes(id);
  const alternar = (id: ColunaId) =>
    setEscondidas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  return { visivel, alternar, escondidas };
}

/* ── Visões salvas ─────────────────────────────────────────────────────────── */

/** O filtro guardado numa visão: o que a tela chama de `filters`, sem busca. */
export type FiltrosSalvos = {
  lifecycleStages?: string[];
  ownerId?: string;
  companyId?: string;
  country?: string;
  city?: string;
  origin?: string;
  createdFrom?: string;
  createdTo?: string;
};

export type VisaoSalva = { id: string; nome: string; filtros: FiltrosSalvos };

const visoesValidas = (v: unknown): v is VisaoSalva[] =>
  Array.isArray(v) && v.every((x) => x && typeof x === "object"
    && typeof (x as VisaoSalva).id === "string" && typeof (x as VisaoSalva).nome === "string"
    && typeof (x as VisaoSalva).filtros === "object");

export function useVisoesSalvas(orgId: string | null | undefined) {
  const [visoes, setVisoes] = useArmazenado<VisaoSalva[]>(
    orgId ? `vx:contatos:visoes:${orgId}` : null, [], visoesValidas,
  );
  const salvar = (nome: string, filtros: FiltrosSalvos): VisaoSalva => {
    const visao = { id: `v${Date.now().toString(36)}`, nome: nome.trim(), filtros };
    setVisoes((atual) => [...atual, visao]);
    return visao;
  };
  const remover = (id: string) => setVisoes((atual) => atual.filter((v) => v.id !== id));
  return { visoes, salvar, remover };
}
