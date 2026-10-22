import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Handshake, Inbox, Users, type LucideIcon } from "lucide-react";
import type { ElementType } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalSearch } from "@/hooks/queries/useGlobalSearch";
import type { SearchCategory, SearchResult } from "@/lib/api/global-search";
import { ACCOUNT_ITEMS, getVisibleNavigation } from "./navegacao";

/**
 * A busca global, num lugar só: a lateral e o diálogo do ⌘K leem DAQUI
 * (consultas escopadas por organização, páginas, histórico). Duplicar isso era
 * convidar as duas a divergirem em escopo ou em erro de categoria.
 */
export const CATEGORIAS_DA_BUSCA: { key: SearchCategory; label: string; singular: string; icon: LucideIcon; todos: string }[] = [
  { key: "contacts", label: "Contatos", singular: "Contato", icon: Users, todos: "/contacts" },
  { key: "companies", label: "Empresas", singular: "Empresa", icon: Building2, todos: "/companies" },
  { key: "deals", label: "Negócios", singular: "Negócio", icon: Handshake, todos: "/deals" },
];

export type PaginaDaBusca = { label: string; path: string; icon: ElementType; keywords: string };

export const normalizar = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

function lerLista<T>(key: string | null, aceita: (item: unknown) => T | null): T[] {
  if (!key) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.map(aceita).filter((item): item is T => item !== null).slice(0, 5) : [];
  } catch { return []; }
}
const lerTermos = (key: string | null): string[] =>
  [...new Set(lerLista(key, (item) => (typeof item === "string" && item.trim() ? item.trim().slice(0, 200) : null)))].slice(0, 5);
export type RegistroRecente = Pick<SearchResult, "id" | "kind" | "title" | "subtitle" | "href">;
const lerRegistros = (key: string | null): RegistroRecente[] => lerLista(key, (item) => {
  const r = item as Partial<RegistroRecente> | null;
  return r && typeof r.id === "string" && typeof r.title === "string" && typeof r.href === "string" && r.href.startsWith("/")
    && (r.kind === "contact" || r.kind === "company" || r.kind === "deal")
    ? { id: r.id, kind: r.kind, title: r.title.slice(0, 200), subtitle: typeof r.subtitle === "string" ? r.subtitle.slice(0, 200) : undefined, href: r.href } : null;
});
const gravar = (key: string | null, valor: unknown) => {
  try { if (key) localStorage.setItem(key, JSON.stringify(valor)); } catch { /* Histórico é opcional. */ }
};

/** Páginas que a busca alcança: o menu, a caixa de e-mail e o menu da conta. */
export function paginasDaBusca(isAdmin: boolean): PaginaDaBusca[] {
  const items = getVisibleNavigation(isAdmin).flatMap((section) => section.items.map((item) => ({
    ...item, label: item.path === "/dashboard" ? section.label : item.label,
    keywords: `${section.label} ${item.label} ${(item.aliases ?? []).join(" ")}`,
  })));
  const account = ACCOUNT_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => ({ ...item, keywords: `Conta ${item.label}` }));
  // Atendimento reúne os três canais; quem busca pelo nome do canal chega nele.
  // A caixa de e-mail completa (pastas, spam, anexos) saiu do menu, mas segue
  // alcançável pela busca.
  const canais = items.map((item) => item.path === "/atendimento" ? { ...item, keywords: `${item.keywords} WhatsApp Instagram E-mail` } : item);
  const caixa = { label: "Caixa de e-mail", path: "/inbox", icon: Inbox, keywords: "Comunicação e-mail Gmail pastas spam anexos" };
  return [...new Map([...canais, caixa, ...account].map((item) => [item.path, item])).values()];
}

export function useBuscaGlobal(search: string, { aberta = true, atrasoMs = 300 }: { aberta?: boolean; atrasoMs?: number } = {}) {
  const { user, profile, isAdmin } = useAuth();
  const term = search.trim();
  const base = user?.id && profile?.org_id ? `${user.id}:${profile.org_id}` : null;
  const key = base ? `vionex-search:${base}` : null;
  const keyRegistros = base ? `vionex-search-registros:${base}` : null;
  const [termos, setTermos] = useState(() => ({ key, lista: lerTermos(key) }));
  const [registros, setRegistros] = useState(() => ({ key: keyRegistros, lista: lerRegistros(keyRegistros) }));
  useEffect(() => { setTermos({ key, lista: lerTermos(key) }); }, [key]);
  useEffect(() => { setRegistros({ key: keyRegistros, lista: lerRegistros(keyRegistros) }); }, [keyRegistros]);
  const recentes = termos.key === key ? termos.lista : [];
  const registrosRecentes = registros.key === keyRegistros ? registros.lista : [];
  const query = useGlobalSearch(search, aberta, atrasoMs);
  const paginas = useMemo(() => paginasDaBusca(isAdmin), [isAdmin]);
  const paginasEncontradas = useMemo(
    () => paginas.filter((page) => normalizar(`${page.label} ${page.keywords}`).includes(normalizar(term))),
    [paginas, term],
  );

  /** Guarda o termo (2+ letras) e, se veio de um registro, o próprio registro. */
  const lembrar = useCallback((registro?: RegistroRecente) => {
    if (key && term.length >= 2) {
      const lista = [term, ...recentes.filter((item) => normalizar(item) !== normalizar(term))].slice(0, 5);
      setTermos({ key, lista });
      gravar(key, lista);
    }
    if (keyRegistros && registro) {
      const lista = [registro, ...registrosRecentes.filter((item) => item.href !== registro.href)].slice(0, 5);
      setRegistros({ key: keyRegistros, lista });
      gravar(keyRegistros, lista);
    }
  }, [key, keyRegistros, term, recentes, registrosRecentes]);
  const limparHistorico = useCallback(() => {
    setTermos({ key, lista: [] });
    setRegistros({ key: keyRegistros, lista: [] });
    try { if (key) localStorage.removeItem(key); if (keyRegistros) localStorage.removeItem(keyRegistros); } catch { /* A lista local já foi limpa. */ }
  }, [key, keyRegistros]);

  return { term, query, paginas, paginasEncontradas, recentes, registrosRecentes, lembrar, limparHistorico, isAdmin };
}
