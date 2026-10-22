import { Fragment, type ElementType, type ReactElement } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, LogOut, PanelLeftClose, Settings } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import vionexLogo from "@/assets/vionex-logo-sidebar.png";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBell } from "@/components/crm/NotificationBell";
import { ACCOUNT_ITEMS, classeDoItemDaLateral, getActiveNavItem, getListaDaLateral } from "./navegacao";
import { CampoDaBuscaLateral, PainelDaBuscaLateral } from "./BuscaDaLateral";
import { useBuscaDaLateral } from "./useBuscaDaLateral";
import { useAtrasadasDaLateral, useNaoLidasDaLateral, useOrganizacaoDaLateral } from "./useContagensDaLateral";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatarNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Selo de contagem ao lado do item, DISCRETO: pílula suave, não um alarme.
 * `perigo` é para o que está ATRASADO; `neutro` para volume que só pede
 * atenção. Zero não desenha nada: um "0" permanente ensina a ignorar o lugar
 * onde o número aparece.
 */
function SeloDaLateral({ id, valor, tom, rotulo }: { id: string; valor: number | null | undefined; tom: "perigo" | "neutro"; rotulo: string }) {
  if (!valor) return null;
  // O link da área tem `aria-label` (o nome dela), que encobre o conteúdo; o
  // número chega ao leitor de tela como DESCRIÇÃO do link, por `id`.
  return (
    <span id={id}
      className={cn("ml-auto flex h-[18px] min-w-6 shrink-0 items-center justify-center vx-selo-nav rounded-full px-1.5 font-semibold tabular-nums",
        tom === "perigo" ? "bg-destructive-soft text-destructive" : "bg-sidebar-accent text-sidebar-muted")}>
      {valor > 99 ? "99+" : valor}<span className="sr-only"> {rotulo}{valor > 99 ? ` (${formatarNumero(valor)})` : ""}</span>
    </span>
  );
}

/** Recolhida, o rótulo vira dica ao lado do ícone. */
function ComDica({ recolhida, dica, children }: { recolhida: boolean; dica: string; children: ReactElement }) {
  if (!recolhida) return children;
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="right" sideOffset={8}>{dica}</TooltipContent></Tooltip>;
}

function ItemDoRodape({ recolhida, rotulo, icone: Icone, ativo, ...destino }: { recolhida: boolean; rotulo: string; icone: ElementType; ativo?: boolean } & ({ to: string; onClick?: () => void } | { href: string })) {
  const conteudo = <>
    <Icone aria-hidden="true" className="h-5 w-5 shrink-0" />
    {!recolhida && <span className="truncate">{rotulo}</span>}
  </>;
  return <ComDica recolhida={recolhida} dica={rotulo}>
    {"href" in destino
      ? <a href={destino.href} aria-label={rotulo} className={classeDoItemDaLateral(recolhida, false)}>{conteudo}</a>
      : <Link to={destino.to} onClick={destino.onClick} aria-label={rotulo} aria-current={ativo ? "page" : undefined} className={classeDoItemDaLateral(recolhida, !!ativo)}>{conteudo}</Link>}
  </ComDica>;
}

/**
 * A lateral do padrão da plataforma.
 *
 * Branca, com borda direita fina. No topo, o logo e o SELETOR DA ORGANIZAÇÃO
 * (avatar redondo com a inicial, nome e setas), que abre o menu da conta, e a
 * BUSCA (⌘K), que expande dentro da lateral e troca a lista pelos resultados.
 * Na borda direita, o botão redondo de recolher/expandir. A lista é PLANA:
 * cada página é um item de primeiro nível, em grupos com rótulo pequeno (sem
 * aninhar nem abrir nada). No rodapé, fixos: Notificações, Ajuda e Configurações.
 *
 * Ativo = texto e ícone na cor de marca, SEM preenchimento; hover cinza muito
 * claro. Recolhida (~57px), só os ícones, com o rótulo em dica.
 *
 * Tudo lê os tokens `--sidebar-*`: tema escuro e cor de destaque chegam sem
 * classe extra.
 */
export function AppSidebar() {
  const { state, open, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const activeItem = getActiveNavItem(pathname);
  const name = profile?.name || "Usuário";
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
  const busca = useBuscaDaLateral(closeMobile);
  const { data: atrasadas } = useAtrasadasDaLateral();
  const { data: naoLidas } = useNaoLidasDaLateral();
  const { data: organizacao } = useOrganizacaoDaLateral();
  const nomeDaOrg = organizacao?.nome?.trim() || name;
  const inicial = nomeDaOrg.charAt(0).toUpperCase() || "V";
  const emConfiguracoes = pathname === "/settings" || pathname.startsWith("/settings/");
  const selos: Record<string, { valor: number | null | undefined; tom: "perigo" | "neutro"; rotulo: string }> = {
    "/activities": { valor: atrasadas, tom: "perigo", rotulo: "atrasadas" },
    "/atendimento": { valor: naoLidas, tom: "neutro", rotulo: "não lidas" },
  };
  const grupos = getListaDaLateral(isAdmin);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className={cn("relative gap-3 pb-0 pt-4", collapsed ? "items-center px-2" : "px-3")}>
        {/* O LOGO ORIGINAL da Vionex. Recolhida, só o símbolo -- a imagem é
            cortada pela esquerda. */}
        {/* Só o logo (e a organização, se houver), como link para o painel. O
            menu da conta mora na engrenagem do rodapé. */}
        <Link to="/dashboard" onClick={closeMobile} title={collapsed ? nomeDaOrg : undefined}
          className={cn("flex flex-col gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed && "items-center")}>
          {/* O LOGO ORIGINAL da Vionex. Recolhida, só o símbolo -- a imagem é
              cortada pela esquerda. */}
          <img src={vionexLogo} alt="Vionex"
            className={cn("shrink-0 object-contain", collapsed ? "h-8 w-8 object-cover object-left" : "ml-1 h-8 w-auto max-w-[140px] object-left")} />
          {!collapsed && organizacao?.nome?.trim() && <span className="flex min-h-8 items-center gap-2.5 px-1.5 text-sidebar-foreground">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">{inicial}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{nomeDaOrg}</span>
          </span>}
        </Link>
        <CampoDaBuscaLateral busca={busca} recolhida={collapsed} />
        {/* Botão redondo na BORDA DIREITA da lateral: recolhe e expande. O
            círculo visível tem 24px; a área de clique, 32px. */}
        {!isMobile && (
          <button type="button" onClick={toggleSidebar} aria-label="Alternar navegação lateral" aria-expanded={open}
            title={open ? "Recolher menu lateral" : "Expandir menu lateral"}
            className="group/recolher absolute -right-4 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-none">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-muted shadow-card transition-colors group-hover/recolher:text-sidebar-foreground group-focus-visible/recolher:ring-2 group-focus-visible/recolher:ring-sidebar-ring">
              {open ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          </button>
        )}
      </SidebarHeader>
      <SidebarContent className={cn("gap-0 pb-3 pt-2", collapsed ? "px-2" : "px-3")}>
        {busca.aberta ? <PainelDaBuscaLateral busca={busca} /> : (
          <nav aria-label="Navegação principal" className="vx-lista" data-volta={busca.voltando ? "true" : "false"}>
            {grupos.map((grupo, g) => {
              const idDoRotulo = `grupo-lateral-${grupo.id}`;
              return <Fragment key={grupo.id}>
                {g > 0 && collapsed && <div role="separator" className="mx-2 my-2 h-px bg-sidebar-border" />}
                <div className={cn(g > 0 && !collapsed && "mt-5")}>
                  {grupo.rotulo && !collapsed && <p id={idDoRotulo} className="vx-lateral-rotulo">{grupo.rotulo}</p>}
                  <ul aria-labelledby={grupo.rotulo && !collapsed ? idDoRotulo : undefined} className="space-y-[3px]">
                    {grupo.itens.map(({ item, rotulo }) => {
                      const atual = activeItem?.path === item.path;
                      const selo = selos[item.path];
                      const idDoSelo = `selo-lateral-${item.path.replace(/\W+/g, "")}`;
                      const link = <Link to={item.path} onClick={closeMobile} aria-label={rotulo} aria-describedby={!collapsed && selo?.valor ? idDoSelo : undefined} aria-current={atual ? "page" : undefined}
                        className={classeDoItemDaLateral(collapsed, atual)}>
                        <item.icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="truncate">{rotulo}</span>}
                        {!collapsed && selo && <SeloDaLateral id={idDoSelo} {...selo} />}
                        {/* Recolhida, o número vira um ponto: cabe no ícone e ainda
                            avisa que há algo esperando. */}
                        {collapsed && selo?.valor ? <span aria-hidden="true" className={cn("absolute right-2 top-1.5 h-2 w-2 rounded-full", selo.tom === "perigo" ? "bg-alerta" : "bg-sidebar-muted")} /> : null}
                      </Link>;
                      return <li key={item.path}>
                        <ComDica recolhida={collapsed} dica={`${rotulo}${selo?.valor ? ` · ${selo.valor} ${selo.rotulo}` : ""}`}>{link}</ComDica>
                      </li>;
                    })}
                  </ul>
                </div>
              </Fragment>;
            })}
          </nav>
        )}
      </SidebarContent>
      {/*
        GRUPO FIXO DO RODAPÉ: Notificações (com selo de contagem), Ajuda (o
        mesmo e-mail de suporte que a tela de erro usa) e Configurações,
        marcada quando alguma tela de configuração está aberta.
      */}
      <SidebarFooter className={cn("gap-[3px] py-3", collapsed ? "px-2" : "px-3")}>
        <NotificationBell recolhida={collapsed} />
        <ItemDoRodape recolhida={collapsed} rotulo="Ajuda" icone={CircleHelp} href="mailto:suporte@vionex.com?subject=Ajuda%20com%20o%20Vionex%20CRM" />
        <DropdownMenu>
          <ComDica recolhida={collapsed} dica="Configurações">
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Configurações" aria-current={emConfiguracoes ? "page" : undefined} className={classeDoItemDaLateral(collapsed, emConfiguracoes)}>
                <Settings aria-hidden="true" className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">Configurações</span>}
              </button>
            </DropdownMenuTrigger>
          </ComDica>
          <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-60">
            <DropdownMenuLabel className="font-normal">
              <span className="block truncate text-sm font-semibold">{name}</span>
              {profile?.email && <span className="block truncate text-xs text-muted-foreground">{profile.email}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ACCOUNT_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => <DropdownMenuItem key={item.path} onSelect={() => { closeMobile(); navigate(item.path); }} className="min-h-10 gap-2 max-md:min-h-11">
              <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{item.label}
            </DropdownMenuItem>)}
            {!isMobile && !collapsed && <DropdownMenuItem onSelect={toggleSidebar} className="min-h-10 gap-2">
              <PanelLeftClose aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />Recolher menu lateral
            </DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="min-h-10 gap-2 text-destructive focus:text-destructive max-md:min-h-11"><LogOut aria-hidden="true" className="h-4 w-4" />Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
