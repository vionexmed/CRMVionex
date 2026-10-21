import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarNumero } from "@/lib/formato";

/**
 * As peças de lista do Visual 01, num lugar só.
 *
 * Contatos, Empresas, Negócios, Orçamentos e Atividades repetem o mesmo
 * vocabulário: abas de visão com contagem, chips de filtro, iniciais no lugar
 * de foto, selo com ponto colorido e a faixa de indicadores no topo. Escritas
 * em cada tela, elas divergiriam no primeiro ajuste -- como aconteceu com as
 * barras de filtro antes de `BarraDeAcoes` existir.
 */

/* ── Abas de visão ─────────────────────────────────────────────────────────── */

export type Visao<T extends string> = {
  valor: T;
  rotulo: string;
  /** Quantos registros a visão traz. Omitir quando a contagem não é barata. */
  contagem?: number;
  /** `alerta` pinta a contagem de vermelho: "sem resposta há 3+ dias". */
  tom?: "normal" | "alerta";
};

/**
 * Visões salvas de uma lista: Todos / Leads novos / Meus contatos…
 *
 * Abas e não um seletor porque as visões são poucas e a pessoa alterna entre
 * elas o dia todo; o número ao lado responde "tem algo aqui?" sem clicar.
 */
export function VisoesDaLista<T extends string>({
  visoes, valor, onChange, rotulo = "Visões da lista", extra, className,
}: {
  visoes: Visao<T>[];
  valor: T;
  onChange: (v: T) => void;
  rotulo?: string;
  /** Ação no fim da linha, como "+ Nova visão". */
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-end gap-1 overflow-x-auto border-b border-border", className)}>
      <div role="tablist" aria-label={rotulo} className="flex min-w-max items-end gap-1">
        {visoes.map((v) => {
          const ativa = v.valor === valor;
          return (
            <button
              key={v.valor}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => onChange(v.valor)}
              className={cn(
                "vx-control -mb-px flex min-h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                ativa ? "border-primary font-semibold text-foreground" : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {v.rotulo}
              {v.contagem !== undefined && (
                <span className={cn(
                  "text-xs font-semibold tabular-nums",
                  v.tom === "alerta" ? "text-destructive" : ativa ? "text-primary" : "text-muted-foreground",
                )}>
                  {formatarNumero(v.contagem)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {extra && <div className="ml-1 flex min-h-10 shrink-0 items-center">{extra}</div>}
    </div>
  );
}

/* ── Chips de filtro ───────────────────────────────────────────────────────── */

/**
 * Filtro aplicado à vista, removível com um clique.
 *
 * Ativo: fundo suave na cor de destaque. Neutro: contorno, para filtros de
 * atalho ainda não ligados ("Quentes", "Atividade atrasada").
 */
export function ChipDeFiltro({
  children, ativo = false, onClick, onRemover, rotuloRemover,
}: {
  children: ReactNode;
  ativo?: boolean;
  onClick?: () => void;
  onRemover?: () => void;
  /** Para leitor de tela: "Remover filtro de estágio". */
  rotuloRemover?: string;
}) {
  const base = "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border text-xs font-medium transition-colors";
  const cor = ativo
    ? "border-transparent bg-accent text-accent-foreground"
    : "border-border bg-card text-foreground hover:bg-surface-2";
  if (onRemover) {
    return (
      <span className={cn(base, cor, "pl-3 pr-1")}>
        {onClick
          ? <button type="button" onClick={onClick} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</button>
          : children}
        <button
          type="button"
          onClick={onRemover}
          aria-label={rotuloRemover ?? "Remover filtro"}
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={cn(base, cor, "px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {children}
    </button>
  );
}

/** "+ Filtro": o chip tracejado que abre o painel de filtros completo. */
export function ChipAdicionarFiltro({ onClick, children = "Filtro" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-input px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Plus aria-hidden="true" className="h-3.5 w-3.5" />{children}
    </button>
  );
}

/** A linha que segura os chips à esquerda e ordenação/colunas/exportar à direita. */
export function LinhaDeFiltros({ children, direita, className }: { children: ReactNode; direita?: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label="Filtros aplicados" className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {direita && <div className="flex flex-wrap items-center gap-2">{direita}</div>}
    </div>
  );
}

/* ── Iniciais ──────────────────────────────────────────────────────────────── */

/** "Hospital São Lucas" → "HS"; "Ana" → "AN". Ignora "Dr.", "Dra." e preposições. */
export function iniciais(nome: string | null | undefined): string {
  const palavras = (nome ?? "")
    .replace(/^(dra?|sr|sra)\.?\s+/i, "")
    .split(/\s+/)
    .filter((p) => p && !/^(de|da|do|das|dos|e)$/i.test(p));
  if (palavras.length === 0) return "?";
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase();
}

/**
 * Iniciais no lugar da foto. Redondo para PESSOA, quadrado para EMPRESA -- a
 * forma diz o que é antes do nome ser lido, numa tabela que mostra os dois.
 */
export function Iniciais({
  nome, forma = "pessoa", tamanho = "md", destaque = false, className,
}: {
  nome: string | null | undefined;
  forma?: "pessoa" | "empresa";
  tamanho?: "sm" | "md" | "lg";
  /** Tom da marca, para o dono do registro ou o usuário atual. */
  destaque?: boolean;
  className?: string;
}) {
  const dim = { sm: "h-6 w-6 text-label", md: "h-8 w-8 text-label", lg: "h-10 w-10 text-xs" }[tamanho];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-semibold tracking-normal",
        forma === "pessoa" ? "rounded-full" : "rounded-md border border-border",
        destaque ? "bg-accent text-accent-foreground" : forma === "pessoa" ? "bg-secondary text-neutral" : "bg-card text-neutral",
        dim, className,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}

/* ── Selo com ponto ────────────────────────────────────────────────────────── */

export type Tom = "marca" | "sucesso" | "atencao" | "perigo" | "info" | "neutro";

const COR_DO_TOM: Record<Tom, { ponto: string; texto: string; fundo: string }> = {
  marca: { ponto: "bg-primary", texto: "text-primary", fundo: "bg-accent" },
  sucesso: { ponto: "bg-success", texto: "text-success", fundo: "bg-success-soft" },
  atencao: { ponto: "bg-warning", texto: "text-warning", fundo: "bg-warning-soft" },
  perigo: { ponto: "bg-destructive", texto: "text-destructive", fundo: "bg-destructive-soft" },
  info: { ponto: "bg-info", texto: "text-info", fundo: "bg-info-soft" },
  neutro: { ponto: "bg-muted-foreground", texto: "text-muted-foreground", fundo: "bg-neutral-soft" },
};

/**
 * Estado em texto curto com um ponto à esquerda: "• Oportunidade", "• Vencido".
 *
 * `variante="pilula"` contorna o selo -- é o formato de ORIGEM ("• WhatsApp"),
 * que é categoria e não estado, e por isso não usa a cor do texto.
 */
export function SeloComPonto({ tom = "neutro", children, variante = "texto", className }: {
  tom?: Tom;
  children: ReactNode;
  variante?: "texto" | "pilula" | "suave";
  className?: string;
}) {
  const c = COR_DO_TOM[tom];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
      variante === "texto" && c.texto,
      variante === "pilula" && "h-6 rounded-full border border-border bg-card px-2.5 text-foreground",
      variante === "suave" && cn("h-6 rounded px-2", c.fundo, c.texto),
      className,
    )}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c.ponto)} />
      {children}
    </span>
  );
}

/* ── Faixa de indicadores ──────────────────────────────────────────────────── */

/**
 * Os números do topo de uma tela, num cartão só dividido por linhas finas.
 *
 * Um cartão por número dava quatro caixas com sombra disputando atenção com a
 * lista logo abaixo. Juntos, leem como UM resumo -- e a lista continua sendo o
 * assunto da tela.
 */
export function FaixaDeIndicadores({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none",
      "[&>*]:border-border [&>*:nth-child(odd)]:border-r lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0 max-lg:[&>*:nth-child(-n+2)]:border-b",
      className,
    )}>
      {children}
    </div>
  );
}

export function Indicador({ rotulo, valor, apoio, variacao, tom, children }: {
  rotulo: string;
  valor: ReactNode;
  /** Linha de baixo: "R$ 212.400", "44% dos enviados". */
  apoio?: ReactNode;
  /** Variação contra o período anterior, já formatada: "+35%". */
  variacao?: { texto: string; positiva: boolean };
  /** Pinta o número: verde para ganho, âmbar para prazo, vermelho para atraso. */
  tom?: "sucesso" | "atencao" | "perigo";
  /** Conteúdo extra à direita (minigráfico). */
  children?: ReactNode;
}) {
  const corValor = tom === "sucesso" ? "text-success" : tom === "atencao" ? "text-warning" : tom === "perigo" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex min-w-0 items-end justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{rotulo}</p>
        <p className="mt-1.5 flex items-baseline gap-2">
          <span className={cn("text-2xl font-bold tabular-nums tracking-tight", corValor)}>{valor}</span>
          {variacao && (
            <span className={cn("text-xs font-semibold tabular-nums", variacao.positiva ? "text-success" : "text-destructive")}>
              {variacao.positiva ? "▲" : "▼"} {variacao.texto}
            </span>
          )}
        </p>
        {apoio && <p className="mt-1 truncate text-xs text-muted-foreground">{apoio}</p>}
      </div>
      {children}
    </div>
  );
}
