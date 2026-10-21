import { Fragment } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, CalendarCheck, Handshake, Plus, Search, UserPlus } from "lucide-react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/crm/NotificationBell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_SECTIONS, getActiveNavItem, getActiveSection } from "./navegacao";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbPart = { label: string; href?: string };
interface AppHeaderProps { onOpenSearch: () => void; actions?: React.ReactNode }

/**
 * "+ Novo" cria qualquer registro de qualquer tela.
 *
 * Cada destino já abre o próprio formulário com `?action=new`; o menu só
 * centraliza a porta de entrada, para cadastrar um contato no meio do funil sem
 * trocar de área antes.
 */
const CRIAR = [
  { rotulo: "Contato", destino: "/contacts?action=new", icone: UserPlus },
  { rotulo: "Negócio", destino: "/deals?action=new", icone: Handshake },
  { rotulo: "Atividade", destino: "/activities?action=new", icone: CalendarCheck },
  { rotulo: "Empresa", destino: "/companies?action=new", icone: Building2 },
] as const;

/**
 * Barra superior do Visual 01: trilha à esquerda, busca no centro, criar e
 * avisos à direita. A busca saiu da lateral e veio para cá porque é a ação mais
 * usada depois de navegar, e no centro ela fica no caminho do olho.
 */
export function AppHeader({ onOpenSearch, actions }: AppHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { open, openMobile, isMobile } = useSidebar();
  const section = NAV_SECTIONS.find((section) => section.id === getActiveSection(pathname));
  const item = getActiveNavItem(pathname);
  // Sem "VIONEX" no começo: a marca já está no topo da lateral.
  const parts: BreadcrumbPart[] = [];
  if (section) {
    parts.push({ label: section.label, href: section.entryPath });
    if (item && item.label !== section.label && section.items.length > 1) parts.push({ label: item.label, href: item.path });
    else if (section.items.length === 1 && item) parts.push({ label: item.label === section.label ? "Visão geral" : item.label });
    if (pathname.startsWith("/deals/")) parts.push({ label: "Detalhe" });
  } else if (pathname.startsWith("/settings")) {
    parts.push({ label: "Configurações", href: "/settings" });
    if (item && item.label !== "Configurações") parts.push({ label: item.label });
  } else parts.push({ label: item?.label || "Página" });

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:gap-4 md:px-6" role="banner">
      <SidebarTrigger className="-ml-1 min-h-11 min-w-11 md:min-h-9 md:min-w-9" aria-label="Alternar navegação lateral" aria-expanded={isMobile ? openMobile : open} />
      <Breadcrumb className="hidden min-w-0 shrink-0 md:flex lg:w-56 xl:w-64">
        <BreadcrumbList className="flex-nowrap">
          {parts.map((part, index) => <Fragment key={`${part.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator className="text-muted-foreground/70">/</BreadcrumbSeparator>}
            <BreadcrumbItem className="min-w-0">
              {index < parts.length - 1 && part.href
                ? <BreadcrumbLink asChild><Link to={part.href} className="truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{part.label}</Link></BreadcrumbLink>
                : <BreadcrumbPage className="truncate font-semibold">{part.label}</BreadcrumbPage>}
            </BreadcrumbItem>
          </Fragment>)}
        </BreadcrumbList>
      </Breadcrumb>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold md:hidden">{parts[parts.length - 1].label}</span>

      {/* Parece campo, é botão: abre a busca compartilhada (⌘K), que é onde os
          resultados por tipo e o teclado já funcionam. */}
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
        <button type="button" onClick={onOpenSearch} aria-label="Buscar no CRM (Ctrl ou ⌘ K)"
          className="flex h-9 w-full max-w-xl items-center gap-2.5 rounded-md border border-border bg-surface-2 px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Buscar contatos, negócios, empresas…</span>
          <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-label text-muted-foreground">⌘K</kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {actions}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 gap-1.5 px-3" aria-label="Criar novo registro">
              <Plus aria-hidden="true" /><span className="hidden sm:inline">Novo</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {CRIAR.map(({ rotulo, destino, icone: Icone }) => (
              <DropdownMenuItem key={destino} onSelect={() => navigate(destino)} className="min-h-9 gap-2.5 max-md:min-h-11">
                <Icone aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{rotulo}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <NotificationBell />
        <button type="button" onClick={onOpenSearch} aria-label="Buscar no CRM (Ctrl ou ⌘ K)"
          className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
          <Search aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
