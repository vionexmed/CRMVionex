import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Building2, Handshake, Inbox, Search, type LucideIcon } from "lucide-react";
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Iniciais } from "@/components/layout/ListaV1";
import { getVisibleNavigation, ACCOUNT_ITEMS } from "@/components/layout/navegacao";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalSearch } from "@/hooks/queries/useGlobalSearch";
import { mensagemErro } from "@/lib/erro-supabase";
import type { SearchCategory } from "@/lib/api/global-search";

const categories: { key: SearchCategory; label: string; icon: LucideIcon }[] = [
  { key: "contacts", label: "Contatos", icon: Users },
  { key: "companies", label: "Empresas", icon: Building2 },
  { key: "deals", label: "Pipeline", icon: Handshake },
];
/** Título de grupo no V1: caixa-alta pequena, como os rótulos de seção da casca. */
const GRUPO = "[&_[cmdk-group-heading]]:text-label [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide";
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
function readHistory(key: string | null): string[] {
  if (!key) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 200)).filter(Boolean))].slice(0, 5)
      : [];
  } catch { return []; }
}

interface CommandPaletteProps { open: boolean; onOpenChange: (open: boolean) => void }

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const key = user?.id && profile?.org_id ? `vionex-search:${user.id}:${profile.org_id}` : null;
  const [history, setHistory] = useState(() => ({ key, terms: readHistory(key) }));
  useEffect(() => { setHistory({ key, terms: readHistory(key) }); }, [key]);
  const recent = history.key === key ? history.terms : [];
  const query = useGlobalSearch(search, open);
  const term = search.trim();

  const pages = useMemo(() => {
    const items = getVisibleNavigation(isAdmin).flatMap((section) => section.items.map((item) => ({
      ...item, label: item.path === "/dashboard" ? section.label : item.label,
      keywords: `${section.label} ${item.label} ${(item.aliases ?? []).join(" ")}`,
    })));
    const account = ACCOUNT_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => ({ ...item, keywords: `Conta ${item.label}` }));
    // Atendimento reúne os três canais; quem busca pelo nome do canal chega nele.
    // A caixa de e-mail completa (pastas, spam, anexos) saiu do menu, mas segue
    // alcançável pela paleta.
    const canais = items.map((item) => item.path === "/atendimento" ? { ...item, keywords: `${item.keywords} WhatsApp Instagram E-mail` } : item);
    const caixa = { label: "Caixa de e-mail", path: "/inbox", icon: Inbox, keywords: "Comunicação e-mail Gmail pastas spam anexos" };
    return [...new Map([...canais, caixa, ...account].map((item) => [item.path, item])).values()];
  }, [isAdmin]);
  const matchingPages = pages.filter((page) => normalize(`${page.label} ${page.keywords}`).includes(normalize(term)));

  const select = (href: string) => {
    if (key && term.length >= 2) {
      const terms = [term, ...recent.filter((item) => normalize(item) !== normalize(term))].slice(0, 5);
      setHistory({ key, terms });
      try { localStorage.setItem(key, JSON.stringify(terms)); } catch { /* Histórico é opcional. */ }
    }
    navigate(href);
    onOpenChange(false);
    setSearch("");
  };
  const clearHistory = () => {
    setHistory({ key, terms: [] });
    try { if (key) localStorage.removeItem(key); } catch { /* A lista local já foi limpa. */ }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}
      commandProps={{ shouldFilter: false, label: "Busca global" }}
      contentProps={{
        onOpenAutoFocus: (event) => { event.preventDefault(); inputRef.current?.focus(); },
        onCloseAutoFocus: (event) => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); },
      }}>
      <CommandInput ref={inputRef} placeholder="Buscar páginas, contatos, empresas e negócios…" aria-label="Buscar no CRM" maxLength={200} value={search} onValueChange={setSearch} />
      <CommandList aria-label="Resultados da busca">
        {term.length < 2 && <p role="status" className="px-4 py-3 text-xs text-muted-foreground">Digite pelo menos 2 caracteres para buscar registros.</p>}
        {query.isSearching && <p role="status" className="px-4 py-3 text-xs text-muted-foreground">Buscando registros…</p>}
        {query.error && <div role="alert" className="px-4 py-3 text-sm">{mensagemErro(query.error)}<Button variant="ghost" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
        {query.data && categories.map(({ key: category, label }) => (
          <CommandGroup key={category} heading={label} className={GRUPO}>
            {query.data?.errors?.[category]
              ? <div role="alert" className="px-2 py-2 text-xs text-muted-foreground">Não foi possível buscar {label.toLocaleLowerCase("pt-BR")}: {query.data.errors[category]}<Button variant="ghost" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>
              : query.data![category].length === 0
                ? <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum resultado em {label.toLocaleLowerCase("pt-BR")}.</p>
                : query.data![category].map((result) => (
                  <CommandItem key={`${result.kind}:${result.id}`} value={`${result.kind}:${result.id}`} onSelect={() => select(result.href)} className="gap-3">
                    <Iniciais nome={result.title} forma={category === "contacts" ? "pessoa" : "empresa"} tamanho="sm" />
                    <span className="min-w-0"><span className="block truncate font-medium" title={result.title}>{result.title}</span>{result.subtitle && <span className="block truncate text-xs text-muted-foreground" title={result.subtitle}>{result.subtitle}</span>}</span>
                  </CommandItem>
                ))}
          </CommandGroup>
        ))}
        {!term && recent.length > 0 && <CommandGroup heading="Buscas recentes" className={GRUPO}>
          {recent.map((item) => <CommandItem key={item} value={`recent:${item}`} onSelect={() => setSearch(item)} className="gap-3"><Search aria-hidden="true" className="h-4 w-4" /><span className="truncate">{item}</span></CommandItem>)}
          <Button variant="ghost" size="sm" onClick={clearHistory}>Limpar histórico</Button>
        </CommandGroup>}
        {matchingPages.length > 0 && <CommandGroup heading="Páginas" className={GRUPO}>
          {matchingPages.map((page) => <CommandItem key={page.path} value={`page:${page.path}`} onSelect={() => select(page.path)} className="gap-3"><page.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{page.label}</CommandItem>)}
        </CommandGroup>}
      </CommandList>
      <p className="border-t border-border bg-surface-2 px-4 py-3 text-xs text-muted-foreground">Até 5 resultados por categoria. ↑↓ navegar · Enter abrir · Esc fechar</p>
    </CommandDialog>
  );
}
