import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getActiveNavItem, getVisibleNavigation } from "./navegacao";

/** Linha de módulos contínua, sem uma segunda sidebar competindo com os dados. */
export function AreaNavigation({ sectionId }: { sectionId: string }) {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const section = getVisibleNavigation(isAdmin).find((section) => section.id === sectionId);
  const activeItem = getActiveNavItem(pathname);
  if (!section || section.items.length < 2) return null;
  return (
    <nav aria-label={`Módulos de ${section.label}`} className="min-w-0 shrink-0 overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-5 px-4 md:px-6">
        {section.items.map((item) => <li key={item.path}>
          <Link to={item.path} aria-current={activeItem?.path === item.path ? "page" : undefined}
            className={cn("flex min-h-11 items-center border-b-2 px-0.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              activeItem?.path === item.path ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
            {item.label}
          </Link>
        </li>)}
      </ul>
    </nav>
  );
}

/** HubSpot: troca de canal no contexto da caixa; cada rota conserva seu contrato. */
export function CommunicationLayout() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AreaNavigation sectionId="comunicacao" />
      <div className="min-h-0 min-w-0 flex-1 p-4 md:p-6"><Outlet /></div>
    </div>
  );
}

/** replace impede que Voltar caia no alias novamente; OAuth e bookmarks conservam parâmetros. */
export function LegacyChannelRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}
