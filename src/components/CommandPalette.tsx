import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Iniciais } from "@/components/layout/ListaV1";
import { CATEGORIAS_DA_BUSCA as categories, useBuscaGlobal } from "@/components/layout/useBuscaGlobal";
import { mensagemErro } from "@/lib/erro-supabase";

/** Título de grupo no V1: caixa-alta pequena, como os rótulos de seção da casca. */
const GRUPO = "[&_[cmdk-group-heading]]:text-label [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide";

interface CommandPaletteProps { open: boolean; onOpenChange: (open: boolean) => void }

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  // Consultas, páginas e histórico vêm do hook que a lateral também usa.
  const { term, query, paginasEncontradas: matchingPages, recentes: recent, lembrar, limparHistorico: clearHistory } = useBuscaGlobal(search, { aberta: open });

  const select = (href: string, registro?: Parameters<typeof lembrar>[0]) => {
    lembrar(registro);
    navigate(href);
    onOpenChange(false);
    setSearch("");
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
                  <CommandItem key={`${result.kind}:${result.id}`} value={`${result.kind}:${result.id}`} onSelect={() => select(result.href, result)} className="gap-3">
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
