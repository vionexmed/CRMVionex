import type { CSSProperties } from "react";
import { ChevronsUpDown, LogOut, PanelLeftClose } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCOUNT_ITEMS, getActiveNavItem, getActiveSection, getVisibleNavigation } from "./navegacao";
import { useAtrasadasDaLateral, useNaoLidasDaLateral, useOrganizacaoDaLateral } from "./useContagensDaLateral";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatarNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Selo de contagem ao lado do item. `perigo` (vermelho) é para o que está
 * ATRASADO; `neutro` para volume que só pede atenção. Zero não desenha nada:
 * um "0" permanente ensina a ignorar o lugar onde o número aparece.
 */
function SeloDaLateral({ id, valor, tom, rotulo }: { id: string; valor: number | null | undefined; tom: "perigo" | "neutro"; rotulo: string }) {
  if (!valor) return null;
  // O link da área tem `aria-label` (o nome dela), que encobre o conteúdo; o
  // número chega ao leitor de tela como DESCRIÇÃO do link, por `id`.
  return (
    <span id={id}
      className={cn("ml-auto flex h-[18px] min-w-8 shrink-0 items-center justify-center vx-selo-nav rounded-full px-1.5 font-bold tabular-nums",
        tom === "perigo" ? "bg-alerta text-white" : "bg-sidebar-accent text-sidebar-foreground")}>
      {valor > 99 ? "99+" : valor}<span className="sr-only"> {rotulo}{valor > 99 ? ` (${formatarNumero(valor)})` : ""}</span>
    </span>
  );
}

/**
 * Lateral navy do Visual 01.
 *
 * As seis áreas ficam no primeiro nível; os módulos da área ATIVA abrem logo
 * abaixo dela, presos por uma linha vertical (Clientes → Contatos, Empresas).
 * A busca mora na barra superior.
 *
 * O MENU DA CONTA SAIU DO RODAPÉ E VIROU O BLOCO DA ORGANIZAÇÃO, no topo -- é
 * onde o Visual 01 o desenha (o "V", o nome e as setas de trocar). Equipe,
 * Configurações, Integrações e Sair continuam a um clique; só mudaram de canto.
 * O rodapé vazio devolve à navegação a altura que ele ocupava.
 *
 * As medidas (248px de largura, item de 38px com 3px de respiro,
 * ícone de 19px, módulo de 29px) vêm da captura de referência a 1440×900 -- ver
 * `scratchpad/harness2` para comparar lado a lado.
 *
 * Tudo lê os tokens `--sidebar-*`: tema escuro e cor de destaque chegam sem
 * classe extra.
 */
export function AppSidebar() {
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const active = getActiveSection(pathname);
  const activeItem = getActiveNavItem(pathname);
  const name = profile?.name || "Usuário";
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
  const { data: org } = useOrganizacaoDaLateral();
  const { data: atrasadas } = useAtrasadasDaLateral();
  const { data: naoLidas } = useNaoLidasDaLateral();
  const nomeDaOrg = org?.nome || "Vionex";
  // Sem segmento nem plano cadastrados, o papel de quem está logado ainda diz
  // algo útil -- melhor que uma linha vazia sob o nome.
  const detalheDaOrg = org?.detalhe || (isAdmin ? "Administração" : "Comercial");
  const selos: Record<string, { valor: number | null | undefined; tom: "perigo" | "neutro"; rotulo: string }> = {
    atividades: { valor: atrasadas, tom: "perigo", rotulo: "atrasadas" },
    comunicacao: { valor: naoLidas, tom: "neutro", rotulo: "não lidas" },
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className={cn("gap-0 pb-0 pt-[26px]", collapsed ? "px-3" : "pl-5 pr-[19px]")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Conta e configurações"
              className={cn("flex min-h-[34px] w-full items-start gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed && "justify-center")}>
              <span aria-hidden="true" className="mt-px flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground">
                {nomeDaOrg.charAt(0).toUpperCase()}
              </span>
              {!collapsed && <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold leading-5 tracking-tight text-white">{nomeDaOrg}</span>
                  <span className="mt-0.5 block truncate text-label text-sidebar-muted">{detalheDaOrg}</span>
                </span>
                <ChevronsUpDown aria-hidden="true" className="mt-[10px] h-4 w-4 shrink-0 text-sidebar-muted" />
              </>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <span className="block truncate text-sm font-semibold">{name}</span>
              {profile?.email && <span className="block truncate text-xs text-muted-foreground">{profile.email}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ACCOUNT_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => <DropdownMenuItem key={item.path} onSelect={() => { closeMobile(); navigate(item.path); }} className="min-h-10 gap-2 max-md:min-h-11">
              <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{item.label}
            </DropdownMenuItem>)}
            {/* A lateral recolhe por aqui (e por Ctrl/⌘ B): o botão de alternar
                da barra superior só aparece com ela recolhida, que é quando
                faz falta -- o Visual 01 não tem esse botão no desktop. */}
            {!isMobile && !collapsed && <DropdownMenuItem onSelect={toggleSidebar} className="min-h-10 gap-2">
              <PanelLeftClose aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />Recolher menu lateral
            </DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="min-h-10 gap-2 text-destructive focus:text-destructive max-md:min-h-11"><LogOut aria-hidden="true" className="h-4 w-4" />Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      <SidebarContent className="gap-0 px-3.5 pb-4">
        {!collapsed && <p className="px-3 pb-[9px] pt-[27px] text-label font-semibold uppercase leading-4 tracking-[0.1em] text-sidebar-muted">Menu</p>}
        <nav aria-label="Navegação principal" className={cn(collapsed && "pt-6")}>
          <ul className="space-y-[3px]">
            {getVisibleNavigation(isAdmin).map((section) => {
              const selected = active === section.id;
              const submodulos = selected && !collapsed && section.items.length > 1;
              const selo = selos[section.id];
              const idDoSelo = `selo-lateral-${section.id}`;
              // Com os módulos abertos abaixo, quem é "a página" é o módulo; a
              // área fica marcada como o lugar em que se está (`true`).
              const link = <Link to={section.entryPath} onClick={closeMobile} aria-label={section.label} aria-describedby={!collapsed && selo?.valor ? idDoSelo : undefined} aria-current={selected ? (submodulos ? "true" : "page") : undefined}
                className={cn("vx-nav-item relative flex h-[38px] w-full items-center rounded-lg text-sm text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring max-md:h-11",
                  collapsed ? "justify-center px-0" : "gap-3 pl-[11px] pr-[11px]", selected ? "vx-nav-active font-semibold" : "font-normal")}>
                <section.icon aria-hidden="true" className="h-[19px] w-[19px] shrink-0" />
                {!collapsed && <span className="truncate pt-[2px] leading-4">{section.label}</span>}
                {!collapsed && selo && <SeloDaLateral id={idDoSelo} {...selo} />}
                {/* Recolhida, o número vira um ponto: cabe no ícone e ainda
                    avisa que há algo esperando. */}
                {collapsed && selo?.valor ? <span aria-hidden="true" className={cn("absolute right-2 top-1.5 h-2 w-2 rounded-full", selo.tom === "perigo" ? "bg-alerta" : "bg-sidebar-foreground")} /> : null}
              </Link>;
              return <li key={section.id}>
                {collapsed
                  ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right" sideOffset={8}>{section.label}{selo?.valor ? ` · ${selo.valor} ${selo.rotulo}` : ""}</TooltipContent></Tooltip>
                  : link}
                {/*
                  Os módulos ficam MONTADOS e a área ativa os abre: a altura anima
                  de 0 a 100% (grid de 0fr para 1fr, que mede o conteúdo sozinho,
                  sem altura cravada) e os itens entram em sequência. Montar e
                  desmontar fazia o menu "pular"; com a troca de área, a que fecha
                  e a que abre se movem juntas e a lista não salta.
                  Fechado, o bloco sai da tabulação e da leitura de tela
                  (`visibility: hidden` ao fim da transição + aria-hidden).
                */}
                {!collapsed && section.items.length > 1 && (
                  <div className="vx-submenu" data-open={selected ? "true" : "false"} aria-hidden={!selected}>
                    <ul aria-label={`Módulos de ${section.label}`} className="mb-[6px] ml-[21px] mt-[5px] space-y-1 border-l border-sidebar-border pl-[18px]">
                      {section.items.map((sub, i) => {
                        const atual = activeItem?.path === sub.path;
                        return <li key={sub.path} style={{ "--vx-i": i } as CSSProperties}>
                          <Link to={sub.path} onClick={closeMobile} aria-current={atual ? "page" : undefined} tabIndex={selected ? undefined : -1}
                            className={cn("flex h-[29px] items-center rounded-md px-2.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring max-md:h-11",
                              atual ? "bg-sidebar-accent font-semibold text-white" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        </li>;
                      })}
                    </ul>
                  </div>
                )}
              </li>;
            })}
          </ul>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
