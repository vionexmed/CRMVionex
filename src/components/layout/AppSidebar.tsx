import { LogOut, MoreHorizontal, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import vionexLogo from "@/assets/vionex-logo-sidebar.png";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCOUNT_ITEMS, getActiveSection, getVisibleNavigation } from "./navegacao";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Attio: marca, busca e destinos no mesmo eixo; módulos ficam dentro da área. */
export function AppSidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const active = getActiveSection(pathname);
  const name = profile?.name || "Usuário";
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };

  const search = (
    <button type="button" onClick={() => { closeMobile(); onOpenSearch(); }} aria-label="Buscar no CRM (Ctrl ou ⌘ K)"
      className={cn("flex min-h-10 w-full items-center rounded border border-sidebar-border bg-background text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11",
        collapsed ? "justify-center px-0" : "gap-2 px-3")}>
      <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
      {!collapsed && <><span className="flex-1 text-left">Buscar no CRM</span><kbd className="text-label font-mono">⌘ K</kbd></>}
    </button>
  );

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className={cn("gap-4 pb-4 pt-5", collapsed ? "px-3" : "px-4")}>
        <Link to="/dashboard" onClick={closeMobile} aria-label="Vionex — Painel" className="flex min-h-11 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img src={vionexLogo} alt="VIONEX" className={collapsed
            ? "h-9 w-9 shrink-0 object-cover object-left" : "h-11 w-auto max-w-[152px] object-contain"} />
        </Link>
        {collapsed ? <Tooltip><TooltipTrigger asChild>{search}</TooltipTrigger><TooltipContent side="right">Buscar no CRM</TooltipContent></Tooltip> : search}
      </SidebarHeader>
      <SidebarContent className={cn("gap-0", collapsed ? "px-3" : "px-3")}>
        <nav aria-label="Navegação principal">
          <ul className="space-y-1">
            {getVisibleNavigation(isAdmin).map((section) => {
              const selected = active === section.id;
              const link = <Link to={section.entryPath} onClick={closeMobile} aria-label={section.label} aria-current={selected ? "page" : undefined}
                className={cn("vx-nav-item flex min-h-10 w-full items-center rounded text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11",
                  collapsed ? "justify-center px-0" : "gap-3 px-3", selected && "vx-nav-active")}>
                <section.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{section.label}</span>}
              </Link>;
              return <li key={section.id}>{collapsed
                ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right" sideOffset={8}>{section.label}</TooltipContent></Tooltip>
                : link}</li>;
            })}
          </ul>
        </nav>
      </SidebarContent>
      <SidebarFooter className={cn("pb-3", collapsed ? "px-3" : "px-3")}>
        <div className="h-px bg-sidebar-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Conta e configurações" className={cn("vx-nav-item mt-2 flex min-h-11 w-full items-center rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed ? "justify-center py-2" : "gap-2.5 px-2 py-2")}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">{name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              {!collapsed && <><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{name}</p><p className="truncate text-xs text-sidebar-foreground">{profile?.email}</p></div><MoreHorizontal aria-hidden="true" className="h-4 w-4 shrink-0" /></>}
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
