import { Link, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ABAS_CELULAR, MOBILE_SECTION_IDS, getActiveSection, getActiveNavItem, gruposDoMenuMais } from "./navegacao";
import { cn } from "@/lib/utils";

/** Quatro áreas fixas; Mais também expõe módulos e conta da mesma fonte. */
export function MobileBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const active = getActiveSection(pathname);
  const activeItem = getActiveNavItem(pathname);
  const groups = gruposDoMenuMais(isAdmin);
  const moreActive = active === "atividades" || active === "analise" || (!active && !!activeItem);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex min-h-14 items-center justify-around border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navegação principal no celular">
      {ABAS_CELULAR.map((item, index) => <Link key={item.url} to={item.url} aria-label={item.title} aria-current={active === MOBILE_SECTION_IDS[index] ? "page" : undefined}
        className={cn("flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", active === MOBILE_SECTION_IDS[index] ? "text-primary" : "text-muted-foreground")}>
        <item.icon aria-hidden="true" className="h-5 w-5" /><span className="text-label font-medium">{item.title}</span>
      </Link>)}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" aria-label="Mais opções de navegação" className={cn("flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", moreActive ? "text-primary" : "text-muted-foreground")}>
          <MoreHorizontal aria-hidden="true" className="h-5 w-5" /><span className="text-label font-medium">Mais</span>
        </button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-2 max-h-[70dvh] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto">
          {groups.map((group, index) => <div key={group.label}>
            {index > 0 && <DropdownMenuSeparator />}<DropdownMenuLabel className="text-xs text-muted-foreground">{group.label}</DropdownMenuLabel>
            {group.items.map((item) => <DropdownMenuItem key={item.url} onSelect={() => navigate(item.url)} className={cn("min-h-11 gap-2", activeItem?.path === item.url && "bg-accent")}>
              <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{item.title}
            </DropdownMenuItem>)}
          </div>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
