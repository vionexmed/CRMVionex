import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "1 resultado" / "N resultados". O texto original do padrão diz "1 resultados",
 * o que é erro de concordância; aqui singular só para exatamente 1.
 */
export function textoDeContagem(n: number): string {
  return n === 1 ? "1 resultado" : `${n} resultados`;
}

export interface BarraDeFerramentasProps {
  busca?: {
    valor: string;
    onChange: (valor: string) => void;
    placeholder?: string;
    rotulo?: string;
  };
  /** Número de resultados; omita para esconder o contador. */
  contador?: number;
  /** Controles secundários, alinhados à direita. */
  children?: React.ReactNode;
  className?: string;
}

/** Linha de ferramentas da lista: busca + contador à esquerda, controles à direita. */
export function BarraDeFerramentas({ busca, contador, children, className }: BarraDeFerramentasProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {busca && (
        <div className="relative w-full max-w-xs sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -mt-2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={busca.valor}
            onChange={(e) => busca.onChange(e.target.value)}
            placeholder={busca.placeholder ?? "Pesquisar…"}
            aria-label={busca.rotulo ?? "Pesquisar"}
            className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}
      {contador !== undefined && (
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {textoDeContagem(contador)}
        </span>
      )}
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
