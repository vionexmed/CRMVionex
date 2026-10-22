import * as React from "react";

import { cn } from "@/lib/utils";

export interface AbaSegmentada {
  valor: string;
  rotulo: string;
  icone?: React.ReactNode;
}

export interface AbasSegmentadasProps {
  abas: AbaSegmentada[];
  valor: string;
  onChange: (valor: string) => void;
  rotulo: string;
  className?: string;
}

/**
 * Grupo com borda e divisores; a aba ativa tem fundo azul-claro e texto azul.
 * Teclado (padrão WAI-ARIA de abas, ativação automática): setas movem e ativam,
 * Home/End vão às pontas, e só a aba ativa entra na ordem do Tab.
 */
export function AbasSegmentadas({ abas, valor, onChange, rotulo, className }: AbasSegmentadasProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const ir = (i: number) => {
    const n = (i + abas.length) % abas.length;
    onChange(abas[n].valor);
    refs.current[n]?.focus();
  };

  const aoTeclar = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight") ir(i + 1);
    else if (e.key === "ArrowLeft") ir(i - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(abas.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className={cn("inline-flex h-9 divide-x divide-border overflow-hidden rounded-md border border-input bg-card", className)}
    >
      {abas.map((a, i) => {
        const ativa = a.valor === valor;
        return (
          <button
            key={a.valor}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            aria-selected={ativa}
            tabIndex={ativa ? 0 : -1}
            onClick={() => onChange(a.valor)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={cn(
              "inline-flex items-center gap-2 px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              ativa ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
            )}
          >
            {a.icone}
            {a.rotulo}
          </button>
        );
      })}
    </div>
  );
}
