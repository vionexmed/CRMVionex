import * as React from "react";

import { cn } from "@/lib/utils";

export interface PaginaProps {
  titulo: string;
  subtitulo?: string;
  /** Ação primária à direita do título (botão azul cheio). */
  acao?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Envelope das telas: cabeçalho dentro do conteúdo (o desktop não tem barra
 * superior). Espaçamentos do padrão: título→barra de ferramentas 24px (`gap-6`),
 * barra→conteúdo 16px (`gap-4`) — por isso os filhos diretos ficam num flex-col
 * de gap-4 e o cabeçalho tem `mb-2` extra (16 + 8 = 24).
 */
export function Pagina({ titulo, subtitulo, acao, children, className }: PaginaProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <header className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="vx-titulo-tela">{titulo}</h1>
          {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
        </div>
        {acao && <div className="flex shrink-0 flex-wrap items-center gap-2">{acao}</div>}
      </header>
      {children}
    </div>
  );
}
