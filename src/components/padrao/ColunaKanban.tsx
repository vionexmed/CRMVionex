import * as React from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/** Cor da faixa/ponto por etapa; todas por token (roxo vem da paleta de gráficos). */
const COR_DA_ETAPA = {
  cinza: { classe: "bg-muted-foreground" },
  azul: { classe: "bg-primary" },
  verde: { classe: "bg-success" },
  laranja: { classe: "bg-warning" },
  vermelho: { classe: "bg-destructive" },
  roxo: { classe: "bg-chart-5" },
} as const;

export type CorDaEtapa = keyof typeof COR_DA_ETAPA;

export function textoDeNegocios(n: number): string {
  if (n === 0) return "Nenhum negócio";
  return n === 1 ? "1 negócio" : `${n} negócios`;
}

export interface ColunaKanbanProps {
  cor: CorDaEtapa;
  titulo: string;
  /** Valor somado da coluna, à esquerda da linha de resumo (já formatado). */
  valor?: React.ReactNode;
  quantidade: number;
  /** Conteúdo do "…" do cabeçalho (um botão/menu), opcional. */
  menu?: React.ReactNode;
  /** Rodapé fixo em largura total, ex.: botão "+ Novo negócio". */
  rodape?: React.ReactNode;
  /** Ref do corpo rolável: é nele que o dnd-kit registra a zona de soltar. */
  corpoRef?: React.Ref<HTMLDivElement>;
  corpoClassName?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Coluna do kanban: cartão branco com faixa colorida de 4px no topo.
 *
 * ATENÇÃO (CLAUDE.md): nenhum wrapper aqui pode ter transform, scale, rotate,
 * filter ou backdrop. Um ancestral assim vira bloco de contenção do
 * `position: fixed` e o DragOverlay "foge do cursor". Realce de zona de soltar:
 * borda/cor, nunca escala.
 */
export function ColunaKanban({
  cor,
  titulo,
  valor,
  quantidade,
  menu,
  rodape,
  corpoRef,
  corpoClassName,
  children,
  className,
}: ColunaKanbanProps) {
  const c = COR_DA_ETAPA[cor];
  return (
    <section
      aria-label={titulo}
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg bg-card shadow-card", className)}
    >
      <div className={cn("h-1 shrink-0", c.classe)} aria-hidden="true" />
      <header className="shrink-0 px-4 pt-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-3 w-3 shrink-0 rounded-full", c.classe)} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{titulo}</span>
          {menu}
        </div>
        <div className="mt-1 flex items-center justify-between pb-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{valor}</span>
          <span>{textoDeNegocios(quantidade)}</span>
        </div>
      </header>
      <div ref={corpoRef} className={cn("min-h-0 flex-1 overflow-y-auto px-3 pb-3", corpoClassName)}>
        {children}
      </div>
      {rodape && <footer className="shrink-0 border-t border-border">{rodape}</footer>}
    </section>
  );
}

export interface NovaColunaProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  rotulo?: string;
}

/** Botão cinza "+ Nova coluna" ao lado da última coluna. */
export function NovaColuna({ rotulo = "Nova coluna", className, type = "button", ...props }: NovaColunaProps) {
  return (
    <button
      type={type}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-muted text-sm font-medium text-muted-foreground outline-none",
        "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {rotulo}
    </button>
  );
}
