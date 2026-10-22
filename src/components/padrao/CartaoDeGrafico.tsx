import * as React from "react";

import { cn } from "@/lib/utils";

export interface EstadoVazioProps {
  icone?: React.ReactNode;
  titulo: string;
  texto?: string;
  acao?: React.ReactNode;
  className?: string;
}

/** Estado vazio centralizado: ícone opcional, título, texto e uma ação. */
export function EstadoVazio({ icone, titulo, texto, acao, className }: EstadoVazioProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-8 text-center", className)}>
      {icone && <span className="flex text-muted-foreground [&>svg]:h-8 [&>svg]:w-8">{icone}</span>}
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {texto && <p className="max-w-sm text-xs text-muted-foreground">{texto}</p>}
      {acao}
    </div>
  );
}

export interface CartaoDeGraficoProps {
  titulo: string;
  subtitulo?: string;
  /** Controle à direita do cabeçalho, tipicamente um select. */
  acao?: React.ReactNode;
  /** Sem dados: mostra "Não há dados" no lugar do corpo. */
  vazio?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/** Cartão branco de gráfico: título, subtítulo, ação e corpo (ou "Não há dados"). */
export function CartaoDeGrafico({ titulo, subtitulo, acao, vazio = false, children, className }: CartaoDeGraficoProps) {
  return (
    <section className={cn("flex flex-col rounded-lg bg-card p-5 shadow-card", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="vx-titulo-secao truncate">{titulo}</h3>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </header>
      {vazio ? (
        <div className="flex min-h-40 flex-1 items-center justify-center text-sm text-muted-foreground">Não há dados</div>
      ) : (
        <div className="min-h-0 flex-1">{children}</div>
      )}
    </section>
  );
}
