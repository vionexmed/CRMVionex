import { useCallback, useEffect, useRef, useState, type ElementType, type KeyboardEvent } from "react";
import { Clock } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { mensagemErro } from "@/lib/erro-supabase";
import type { SearchResult } from "@/lib/api/global-search";
import { CATEGORIAS_DA_BUSCA, useBuscaGlobal } from "./useBuscaGlobal";
import { getListaDaLateral } from "./navegacao";

/** Evento que a casca dispara no ⌘K / Ctrl+K quando a lateral está visível. */
export const EVENTO_ABRIR_BUSCA = "vx:abrir-busca";
export const ID_DA_LISTA_DE_BUSCA = "busca-lateral-lista";
const MAX_POR_GRUPO = 5;
const SAIDA_MS = 150;

export type OpcaoDaBusca = {
  id: string; titulo: string; apoio?: string; tipo: string;
  icone?: ElementType; forma?: "pessoa" | "empresa"; destacar?: boolean;
  aoEscolher: () => void;
};
export type SecaoDaBusca = { id: string; rotulo: string; opcoes: OpcaoDaBusca[]; carregando?: boolean; erro?: string };

const semMovimento = () => typeof window !== "undefined" && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const campoEditavel = (alvo: EventTarget | null) => alvo instanceof HTMLElement
  && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));

/**
 * Estado da busca DENTRO da lateral: abrir/fechar com saída animada, o termo, as
 * seções do painel e a navegação por teclado (↑/↓/Enter/Esc). O campo (no topo
 * da lateral) e o painel (no lugar da lista) leem o mesmo objeto.
 *
 * Recolhida, a lateral se expande só enquanto a busca está aberta e volta a
 * recolher ao fechar -- sem mexer na preferência salva, que termina igual.
 */
export function useBuscaDaLateral(aoNavegar?: () => void) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { open, setOpen, isMobile } = useSidebar();
  const [aberta, setAberta] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const reabrir = useRef(false);
  const devolverFoco = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const jaAbriu = useRef(false);

  const busca = useBuscaGlobal(termo, { aberta, atrasoMs: 250 });
  const { term, query, paginasEncontradas, recentes, registrosRecentes, lembrar, limparHistorico, isAdmin } = busca;

  const abrir = useCallback(() => {
    clearTimeout(timer.current);
    setSaindo(false);
    if (!isMobile && !open) { reabrir.current = true; setOpen(true); }
    jaAbriu.current = true;
    setAberta(true);
    campoRef.current?.focus();
  }, [isMobile, open, setOpen]);

  const fechar = useCallback((comFoco = true) => {
    clearTimeout(timer.current);
    const fim = () => {
      setAberta(false); setSaindo(false); setTermo("");
      devolverFoco.current = comFoco;
      if (reabrir.current) { reabrir.current = false; setOpen(false); }
    };
    if (semMovimento()) fim(); else { setSaindo(true); timer.current = setTimeout(fim, SAIDA_MS); }
  }, [setOpen]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Foco: no campo ao abrir; de volta ao "Buscar" ao fechar (quando pedido).
  useEffect(() => {
    if (aberta) campoRef.current?.focus();
    else if (devolverFoco.current) { devolverFoco.current = false; gatilhoRef.current?.focus(); }
  }, [aberta]);
  // Trocar de página fecha a busca (o resultado escolhido já navegou).
  const rotaAnterior = useRef(pathname);
  useEffect(() => {
    if (rotaAnterior.current !== pathname && aberta) fechar(false);
    rotaAnterior.current = pathname;
  }, [pathname, aberta, fechar]);
  // Atalhos: o evento da casca (⌘K) e "/" quando nenhum campo tem foco.
  useEffect(() => {
    if (isMobile) return;
    const aoEvento = () => abrir();
    const aoTecla = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.isComposing || campoEditavel(e.target)) return;
      e.preventDefault(); abrir();
    };
    window.addEventListener(EVENTO_ABRIR_BUSCA, aoEvento);
    document.addEventListener("keydown", aoTecla);
    return () => { window.removeEventListener(EVENTO_ABRIR_BUSCA, aoEvento); document.removeEventListener("keydown", aoTecla); };
  }, [isMobile, abrir]);

  const escolher = useCallback((href: string, registro?: Pick<SearchResult, "id" | "kind" | "title" | "subtitle" | "href">) => {
    lembrar(registro);
    navigate(href);
    aoNavegar?.();
    fechar(false);
  }, [lembrar, navigate, aoNavegar, fechar]);

  const opcaoDeRegistro = (r: Pick<SearchResult, "id" | "kind" | "title" | "subtitle" | "href">, prefixo: string): OpcaoDaBusca => ({
    id: `${prefixo}-${r.kind}-${r.id}`, titulo: r.title, apoio: r.subtitle,
    tipo: r.kind === "contact" ? "Contato" : r.kind === "company" ? "Empresa" : "Negócio",
    forma: r.kind === "company" ? "empresa" : "pessoa", destacar: prefixo === "res",
    aoEscolher: () => escolher(r.href, r),
  });
  const opcaoDePagina = (p: { label: string; path: string; icon: ElementType }, prefixo: string): OpcaoDaBusca => ({
    id: `${prefixo}-${p.path.replace(/\W+/g, "-")}`, titulo: p.label, tipo: "Página", icone: p.icon, destacar: prefixo === "pag",
    aoEscolher: () => escolher(p.path),
  });

  // ── Seções do painel ────────────────────────────────────────────────────
  const secoes: SecaoDaBusca[] = [];
  let dica: string | undefined;
  let semResultado = false;
  const falhas: string[] = [];
  if (term.length === 0) {
    const recentesOpcoes: OpcaoDaBusca[] = [
      ...registrosRecentes.map((r) => opcaoDeRegistro(r, "rec")),
      ...recentes.map((t): OpcaoDaBusca => ({ id: `ter-${t}`, titulo: t, tipo: "Busca", icone: Clock, aoEscolher: () => setTermo(t) })),
    ];
    if (recentesOpcoes.length) secoes.push({ id: "recentes", rotulo: "Recentes", opcoes: recentesOpcoes });
    const atalhos = getListaDaLateral(isAdmin).flatMap((g) => g.itens).map((i) => opcaoDePagina({ label: i.rotulo, path: i.item.path, icon: i.item.icon }, "ir"));
    secoes.push({ id: "ir-para", rotulo: "Ir para", opcoes: atalhos });
  } else {
    const paginas = paginasEncontradas.slice(0, MAX_POR_GRUPO).map((p) => opcaoDePagina(p, "pag"));
    if (paginas.length) secoes.push({ id: "paginas", rotulo: "Páginas", opcoes: paginas });
    if (term.length < 2) dica = "Digite pelo menos 2 letras para buscar contatos, empresas e negócios.";
    else if (query.data) {
      for (const cat of CATEGORIAS_DA_BUSCA) {
        const erro = query.data.errors?.[cat.key];
        const lista = query.data[cat.key];
        if (erro) { falhas.push(`${cat.label}: ${erro}`); secoes.push({ id: cat.key, rotulo: cat.label, opcoes: [], erro: `Não foi possível buscar ${cat.label.toLocaleLowerCase("pt-BR")}.` }); continue; }
        if (!lista.length) continue;
        const opcoes = lista.slice(0, MAX_POR_GRUPO).map((r) => opcaoDeRegistro(r, "res"));
        if (lista.length >= MAX_POR_GRUPO) opcoes.push({
          id: `todos-${cat.key}`, titulo: `Ver todos em ${cat.label.toLocaleLowerCase("pt-BR")}`, tipo: "", icone: cat.icon,
          aoEscolher: () => escolher(cat.key === "deals" ? `/deals?q=${encodeURIComponent(term)}` : cat.todos),
        });
        secoes.push({ id: cat.key, rotulo: cat.label, opcoes });
      }
    } else if (query.isSearching) {
      for (const cat of CATEGORIAS_DA_BUSCA) secoes.push({ id: cat.key, rotulo: cat.label, opcoes: [], carregando: true });
    }
    if (query.error) falhas.push(mensagemErro(query.error));
    semResultado = term.length >= 2 && !query.isSearching && !query.error && !secoes.some((s) => s.opcoes.length || s.erro);
  }
  const opcoes = secoes.flatMap((s) => s.opcoes);
  const assinatura = opcoes.map((o) => o.id).join("|");
  useEffect(() => { setAtivo(0); }, [assinatura]);
  const ativoId = aberta && opcoes[ativo] ? `busca-op-${opcoes[ativo].id}` : undefined;
  const total = opcoes.filter((o) => o.tipo).length;
  const anuncio = term.length >= 2
    ? query.isSearching && !query.data ? "Buscando…"
      : semResultado ? `Nenhum resultado para ${term}` : `${total} ${total === 1 ? "resultado" : "resultados"}`
    : "";

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!opcoes.length) return;
      setAtivo((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + opcoes.length) % opcoes.length);
    } else if (e.key === "Enter") {
      e.preventDefault(); opcoes[ativo]?.aoEscolher();
    } else if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (termo) setTermo(""); else fechar(true);
    }
  };

  return {
    aberta, saindo, termo, setTermo, abrir, fechar, ativo, setAtivo, ativoId, aoTeclar,
    gatilhoRef, campoRef, secoes, opcoes, dica, semResultado, falhas, anuncio, term,
    temHistorico: recentes.length + registrosRecentes.length > 0, limparHistorico,
    tentarDeNovo: (): void => { void query.refetch(); }, voltando: jaAbriu.current && !aberta,
  };
}
export type BuscaDaLateral = ReturnType<typeof useBuscaDaLateral>;
