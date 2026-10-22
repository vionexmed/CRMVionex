import * as React from "react";

import { cn } from "@/lib/utils";

export interface PaginaProps {
  titulo: string;
  subtitulo?: string;
  /** Ação primária à direita do título (botão azul cheio). */
  acao?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /**
   * A página ocupa a altura da tela e NÃO rola: só a área que o filho marcar
   * com `min-h-0 flex-1 overflow-auto` (a lista) rola. Título, barra de
   * ferramentas e paginação ficam parados. Sem isto a página cresce com a lista
   * e é a área inteira que rola, levando o cabeçalho embora.
   */
  preencher?: boolean;
}

/**
 * Envelope das telas: cabeçalho dentro do conteúdo (o desktop não tem barra
 * superior). Espaçamentos do padrão: título→barra de ferramentas 24px (`gap-6`),
 * barra→conteúdo 16px (`gap-4`) — por isso os filhos diretos ficam num flex-col
 * de gap-4 e o cabeçalho tem `mb-2` extra (16 + 8 = 24).
 */
export function Pagina({ titulo, subtitulo, acao, children, className, preencher = false }: PaginaProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", preencher && "h-full", className)}>
      <header className="mb-2 flex shrink-0 flex-wrap items-start justify-between gap-3">
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
