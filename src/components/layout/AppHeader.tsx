import { Fragment } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, CalendarCheck, CircleHelp, Handshake, Plus, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
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
    else if (section.items.length === 1 && item) parts.push({ label: item.label === section.label ? "Visão geral" : item.label, href: item.path });
    if (pathname.startsWith("/deals/")) parts.push({ label: "Detalhe" });
    // A caixa de e-mail completa é alias de Atendimento no menu, mas é outra tela.
    if (pathname === "/inbox" || pathname.startsWith("/inbox/")) parts.push({ label: "Caixa de e-mail" });
  } else if (pathname.startsWith("/settings")) {
    parts.push({ label: "Configurações", href: "/settings" });
    if (item && item.label !== "Configurações") parts.push({ label: item.label });
  } else parts.push({ label: item?.label || "Página" });

  return (
    /*
     * Medidas da captura de referência a 1440×900: 65px de altura, 28px de
     * respiro lateral (o mesmo do conteúdo, para a trilha alinhar com o título
     * da tela), busca de 550px logo depois da trilha e as ações coladas à
     * direita. Ver `scratchpad/harness2` para comparar lado a lado.
     */
    <header className="z-30 flex h-[65px] shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:gap-4 md:pl-7 md:pr-[29px]" role="banner">
      {/* O Visual 01 não tem este botão no desktop: lá a lateral recolhe pelo
          menu da conta (e por Ctrl/⌘ B). Ele continua no celular, onde a
          lateral vive escondida, e volta no desktop quando ela está recolhida
          -- senão não haveria por onde abri-la de novo com o mouse. */}
      <SidebarTrigger className={cn("-ml-1 min-h-11 min-w-11 md:min-h-9 md:min-w-9", open && "md:hidden")} aria-label="Alternar navegação lateral" aria-expanded={isMobile ? openMobile : open} />
      <Breadcrumb className="hidden min-w-[179px] shrink-0 pb-[3px] md:flex">
        <BreadcrumbList className="vx-trilha flex-nowrap gap-2 sm:gap-2">
          {parts.map((part, index) => <Fragment key={`${part.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator className="text-muted-foreground/70">/</BreadcrumbSeparator>}
            <BreadcrumbItem className="min-w-0">
              {index < parts.length - 1 && part.href
                ? <BreadcrumbLink asChild><Link to={part.href} className="truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{part.label}</Link></BreadcrumbLink>
                : <BreadcrumbPage className="truncate font-semibold text-foreground">{part.label}</BreadcrumbPage>}
            </BreadcrumbItem>
          </Fragment>)}
        </BreadcrumbList>
      </Breadcrumb>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold md:hidden">{parts[parts.length - 1].label}</span>

      {/* Parece campo, é botão: abre a busca compartilhada (⌘K), que é onde os
          resultados por tipo e o teclado já funcionam. */}
      <div className="hidden min-w-0 flex-1 md:flex">
        <button type="button" onClick={onOpenSearch} aria-label="Buscar no CRM (Ctrl ou ⌘ K)"
          className="flex h-[42px] w-full max-w-[550px] items-center gap-[13px] rounded-lg border border-border bg-surface-2 px-3.5 text-sm text-muted-foreground transition-colors hover:border-input hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Buscar contatos, negócios, empresas…</span>
          <kbd className="flex h-5 items-center rounded border border-border bg-card px-1.5 font-sans text-label leading-none text-muted-foreground">⌘K</kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {actions}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="lg" className="h-[38px] gap-1.5 px-3.5" aria-label="Criar novo registro">
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
        {/* Ajuda leva a um lugar de verdade: o mesmo e-mail de suporte que a
            tela de erro já usa. Um ícone de ajuda que não abre nada ensinaria a
            não pedir ajuda. */}
        <a href="mailto:suporte@vionex.com?subject=Ajuda%20com%20o%20Vionex%20CRM" aria-label="Ajuda: falar com o suporte" title="Falar com o suporte"
          className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex">
          <CircleHelp aria-hidden="true" className="h-[18px] w-[18px]" />
        </a>
        <NotificationBell />
        <button type="button" onClick={onOpenSearch} aria-label="Buscar no CRM (Ctrl ou ⌘ K)"
          className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
          <Search aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
