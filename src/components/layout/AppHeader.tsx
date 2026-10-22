import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { NAV_SECTIONS, getActiveNavItem, getActiveSection } from "./navegacao";

interface AppHeaderProps { onOpenSearch: () => void }

/**
 * A barra compacta do CELULAR.
 *
 * O padrão da plataforma não tem barra superior no desktop: o cabeçalho de cada
 * tela vive dentro do conteúdo (título, subtítulo e ação primária), a busca é
 * o item "Buscar" da lateral e as notificações moram no rodapé dela. No
 * celular a lateral vive escondida, então sobra esta barra: o botão de menu,
 * o nome da tela e a busca. O AppLayout só a monta no celular; o `md:hidden`
 * é a garantia de que ela não aparece numa tela larga.
 */
export function AppHeader({ onOpenSearch }: AppHeaderProps) {
  const { pathname } = useLocation();
  const { openMobile } = useSidebar();
  const section = NAV_SECTIONS.find((s) => s.id === getActiveSection(pathname));
  const item = getActiveNavItem(pathname);
  // A caixa de e-mail completa é alias de Atendimento no menu, mas é outra tela.
  const titulo = pathname === "/inbox" || pathname.startsWith("/inbox/") ? "Caixa de e-mail"
    : item?.label ?? section?.label ?? (pathname.startsWith("/settings") ? "Configurações" : null);

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-card px-2 md:hidden" role="banner">
      <SidebarTrigger className="min-h-11 min-w-11" aria-label="Alternar navegação lateral" aria-expanded={openMobile} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{titulo}</span>
      {/* A mesma busca compartilhada do ⌘K. */}
      <button type="button" onClick={onOpenSearch} aria-label="Buscar no CRM (Ctrl ou ⌘ K)"
        className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Search aria-hidden="true" className="h-5 w-5" />
      </button>
    </header>
  );
}
