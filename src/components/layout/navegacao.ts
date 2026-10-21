import type { ElementType } from "react";
import {
  Activity, AlertTriangle, BarChart3, Briefcase, Building2, Handshake,
  LayoutDashboard, Mail, Megaphone, MessageSquare,
  Package, Plug, Receipt, Settings, Shield, Users, UsersRound,
} from "lucide-react";

export type NavItem = {
  label: string;
  path: string;
  icon: ElementType;
  adminOnly?: boolean;
  aliases?: string[];
};
export type NavSection = {
  id: string;
  label: string;
  icon: ElementType;
  entryPath: string;
  items: NavItem[];
};

/** Fonte única: a lateral mostra áreas; os módulos vivem dentro de cada área. */
export const NAV_SECTIONS: NavSection[] = [
  { id: "painel", label: "Painel", icon: LayoutDashboard, entryPath: "/dashboard", items: [
    { label: "Visão geral", path: "/dashboard", icon: LayoutDashboard },
  ] },
  { id: "atividades", label: "Atividades", icon: Activity, entryPath: "/activities", items: [
    { label: "Atividades", path: "/activities", icon: Activity, aliases: ["/tasks"] },
  ] },
  { id: "clientes", label: "Clientes", icon: Users, entryPath: "/contacts", items: [
    { label: "Contatos", path: "/contacts", icon: Users, aliases: ["/leads"] },
    { label: "Empresas", path: "/companies", icon: Building2 },
  ] },
  { id: "negocios", label: "Negócios", icon: Briefcase, entryPath: "/deals", items: [
    { label: "Funil", path: "/deals", icon: Handshake },
    { label: "Produtos", path: "/produtos", icon: Package },
    { label: "Orçamentos", path: "/orcamentos", icon: Receipt },
  ] },
  /*
   * UM destino para os três canais. O canal é filtro DENTRO de Atendimento
   * (`?canal=`), porque quem atende pensa em QUEM espera resposta, não no
   * aplicativo por onde a pergunta chegou. `/inbox` (caixa de e-mail completa:
   * pastas, spam, anexos) continua sendo tela, fora do menu -- o cabeçalho de
   * Atendimento leva até ela --, e por isso é alias: abrir a caixa mantém
   * Comunicação acesa. As rotas antigas de canal redirecionam para cá.
   */
  { id: "comunicacao", label: "Comunicação", icon: MessageSquare, entryPath: "/atendimento", items: [
    { label: "Atendimento", path: "/atendimento", icon: MessageSquare, aliases: ["/conversations", "/instagram", "/inbox", "/comunicacao"] },
  ] },
  { id: "analise", label: "Análise", icon: BarChart3, entryPath: "/reports", items: [
    { label: "Relatórios", path: "/reports", icon: BarChart3 },
    { label: "Marketing", path: "/marketing/visao-geral", icon: Megaphone, adminOnly: true, aliases: ["/marketing"] },
  ] },
];

export const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Equipe", path: "/team", icon: UsersRound },
  { label: "Configurações", path: "/settings", icon: Settings },
  { label: "Meu e-mail", path: "/settings/email", icon: Mail },
  { label: "Integrações", path: "/settings/integrations", icon: Plug, adminOnly: true },
  { label: "Segurança", path: "/settings/security", icon: Shield, adminOnly: true },
];

export function getVisibleNavigation(isAdmin: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => isAdmin || !item.adminOnly) }))
    .filter((section) => section.items.length > 0);
}

/** Limite de segmento evita marcar /deals-old como se fosse /deals. */
const cleanPath = (path: string) => path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
const destinations = [
  ...NAV_SECTIONS.flatMap((section) => section.items.flatMap((item) =>
    [item.path, ...(item.aliases ?? [])].map((path) => ({ path, item, section })))),
  ...ACCOUNT_ITEMS.map((item) => ({ path: item.path, item, section: null as NavSection | null })),
].sort((a, b) => b.path.length - a.path.length);

export function getActiveSection(pathname: string): string | null {
  return destinations.find((destination) => matches(cleanPath(pathname), destination.path))?.section?.id ?? null;
}
export function getActiveNavItem(pathname: string): NavItem | null {
  return destinations.find((destination) => matches(cleanPath(pathname), destination.path))?.item ?? null;
}

// Projeções compatíveis: PageHeader e consumidores antigos continuam lendo a
// mesma fonte. Não introduzir um segundo catálogo ao evoluir esses consumidores.
export type ItemNav = { title: string; url: string; icon: ElementType; adminOnly?: boolean; noCelular?: boolean };
export type GrupoNav = { label: string; items: ItemNav[] };
const toLegacyItem = (item: NavItem): ItemNav => ({ title: item.label, url: item.path, icon: item.icon, adminOnly: item.adminOnly });
export const NAV_GRUPOS: GrupoNav[] = NAV_SECTIONS.map((section) => ({ label: section.label, items: section.items.map(toLegacyItem) }));
export const MENU_DA_CONTA: ItemNav[] = ACCOUNT_ITEMS.map(toLegacyItem);
export const ICONE_RISCO = AlertTriangle;
export const MOBILE_SECTION_IDS = ["painel", "clientes", "negocios", "comunicacao"];
export const ABAS_CELULAR: ItemNav[] = MOBILE_SECTION_IDS.map((id) => {
  const section = NAV_SECTIONS.find((section) => section.id === id)!;
  return { title: section.label, url: section.entryPath, icon: section.icon, noCelular: true };
});
export function gruposDoMenuMais(isAdmin: boolean): GrupoNav[] {
  const fixedPaths = new Set(ABAS_CELULAR.map((item) => item.url));
  return [
    ...getVisibleNavigation(isAdmin).map((section) => ({ label: section.label, items: section.items.map(toLegacyItem) })),
    { label: "Conta", items: MENU_DA_CONTA.filter((item) => isAdmin || !item.adminOnly) },
  ].map((group) => ({ ...group, items: group.items.filter((item) => !fixedPaths.has(item.url)) }))
    .filter((group) => group.items.length > 0);
}
export function grupoDaRota(pathname: string): string | undefined {
  const destination = destinations.find((destination) => matches(cleanPath(pathname), destination.path));
  return destination ? destination.section?.label ?? "Conta" : undefined;
}
