import { LogOut, MoreHorizontal } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCOUNT_ITEMS, getActiveNavItem, getActiveSection, getVisibleNavigation } from "./navegacao";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Lateral navy do Visual 01.
 *
 * As seis áreas ficam no primeiro nível; os módulos da área ATIVA abrem logo
 * abaixo dela, presos por uma linha vertical (Clientes → Contatos, Empresas).
 * Antes os módulos moravam numa faixa de abas dentro do conteúdo, a uma tela de
 * distância do item que os explicava. A busca foi para a barra superior.
 *
 * Tudo lê os tokens `--sidebar-*`: tema escuro e cor de destaque chegam sem
 * classe extra.
 */
export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const active = getActiveSection(pathname);
  const activeItem = getActiveNavItem(pathname);
  const name = profile?.name || "Usuário";
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className={cn("pb-2 pt-4", collapsed ? "px-3" : "px-3")}>
        <Link to="/dashboard" onClick={closeMobile} aria-label="Vionex — Painel"
          className={cn("flex min-h-12 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed ? "justify-center" : "px-1.5")}>
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground">V</span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-white">Vionex</span>
              <span className="block truncate text-xs text-sidebar-muted">{isAdmin ? "Administração" : "Comercial"}</span>
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0 px-3">
        {!collapsed && <p className="px-2.5 pb-2 pt-4 text-label font-semibold uppercase tracking-[0.08em] text-sidebar-muted">Menu</p>}
        <nav aria-label="Navegação principal" className={cn(collapsed && "pt-3")}>
          <ul className="space-y-0.5">
            {getVisibleNavigation(isAdmin).map((section) => {
              const selected = active === section.id;
              const submodulos = selected && !collapsed && section.items.length > 1;
              // Com os módulos abertos abaixo, quem é "a página" é o módulo; a
              // área fica marcada como o lugar em que se está (`true`).
              const link = <Link to={section.entryPath} onClick={closeMobile} aria-label={section.label} aria-current={selected ? (submodulos ? "true" : "page") : undefined}
                className={cn("vx-nav-item flex min-h-10 w-full items-center rounded-lg text-sm font-medium text-sidebar-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring max-md:min-h-11",
                  collapsed ? "justify-center px-0" : "gap-3 px-3", selected && "vx-nav-active")}>
                <section.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{section.label}</span>}
              </Link>;
              return <li key={section.id}>
                {collapsed
                  ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right" sideOffset={8}>{section.label}</TooltipContent></Tooltip>
                  : link}
                {submodulos && (
                  <ul aria-label={`Módulos de ${section.label}`} className="mb-1 ml-[22px] mt-1 space-y-0.5 border-l border-sidebar-border pl-2.5">
                    {section.items.map((sub) => {
                      const atual = activeItem?.path === sub.path;
                      return <li key={sub.path}>
                        <Link to={sub.path} onClick={closeMobile} aria-current={atual ? "page" : undefined}
                          className={cn("flex min-h-8 items-center rounded-md px-2.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring max-md:min-h-11",
                            atual ? "bg-sidebar-accent font-semibold text-white" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      </li>;
                    })}
                  </ul>
                )}
              </li>;
            })}
          </ul>
        </nav>
      </SidebarContent>
      <SidebarFooter className="px-3 pb-3">
        <div className="h-px bg-sidebar-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Conta e configurações" className={cn("vx-nav-item mt-2 flex min-h-11 w-full items-center rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed ? "justify-center py-2" : "gap-2.5 px-2 py-2")}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">{name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              {!collapsed && <><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{name}</p><p className="truncate text-xs text-sidebar-muted">{profile?.email}</p></div><MoreHorizontal aria-hidden="true" className="h-4 w-4 shrink-0 text-sidebar-muted" /></>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            {ACCOUNT_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => <DropdownMenuItem key={item.path} onSelect={() => { closeMobile(); navigate(item.path); }} className="min-h-10 gap-2 max-md:min-h-11">
              <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{item.label}
            </DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="min-h-10 gap-2 text-destructive focus:text-destructive max-md:min-h-11"><LogOut aria-hidden="true" className="h-4 w-4" />Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
