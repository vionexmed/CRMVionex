import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/crm/NotificationBell";
import { NAV_SECTIONS, getActiveNavItem, getActiveSection } from "./navegacao";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbPart = { label: string; href?: string };
interface AppHeaderProps { onOpenSearch: () => void; actions?: React.ReactNode }

export function AppHeader({ onOpenSearch, actions }: AppHeaderProps) {
  const { pathname } = useLocation();
  const { open, openMobile, isMobile } = useSidebar();
  const section = NAV_SECTIONS.find((section) => section.id === getActiveSection(pathname));
  const item = getActiveNavItem(pathname);
  const parts: BreadcrumbPart[] = [{ label: "VIONEX", href: "/dashboard" }];
  if (section) {
    parts.push({ label: section.label, href: section.entryPath });
    if (item && item.label !== section.label && section.items.length > 1) parts.push({ label: item.label, href: item.path });
    if (pathname.startsWith("/deals/")) parts.push({ label: "Detalhe" });
  } else if (pathname.startsWith("/settings/")) {
    parts.push({ label: "Configurações", href: "/settings" }, { label: item?.label || "Página" });
  } else parts.push({ label: item?.label || "Página" });

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4 md:gap-4 md:px-6" role="banner">
      <SidebarTrigger className="-ml-1 min-h-11 min-w-11 md:min-h-9 md:min-w-9" aria-label="Alternar navegação lateral" aria-expanded={isMobile ? openMobile : open} />
      <Breadcrumb className="hidden min-w-0 flex-1 md:flex">
        <BreadcrumbList className="flex-nowrap">
          {parts.map((part, index) => <Fragment key={`${part.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem className="min-w-0">
              {index < parts.length - 1 && part.href
                ? <BreadcrumbLink asChild><Link to={part.href} className="truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{part.label}</Link></BreadcrumbLink>
                : <BreadcrumbPage className="truncate">{part.label}</BreadcrumbPage>}
            </BreadcrumbItem>
          </Fragment>)}
        </BreadcrumbList>
      </Breadcrumb>
      <span className="min-w-0 flex-1 truncate text-sm font-medium md:hidden">{parts[parts.length - 1].label}</span>
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {actions}<NotificationBell />
        <button type="button" onClick={onOpenSearch} aria-label="Buscar no CRM (Ctrl ou ⌘ K)"
          className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
          <Search aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
