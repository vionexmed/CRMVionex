import * as React from "react";
import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TONS_DO_ICONE = {
  destaque: "text-primary",
  sucesso: "text-success",
  perigo: "text-destructive",
  alerta: "text-warning",
  neutro: "text-muted-foreground",
} as const;

export interface CartaoDeIndicadorProps {
  rotulo: string;
  valor: React.ReactNode;
  subtexto?: React.ReactNode;
  /** Ícone à direita; a cor vem de `tom`. */
  icone?: React.ReactNode;
  tom?: keyof typeof TONS_DO_ICONE;
  selecionado?: boolean;
  /** Com onClick o cartão vira botão (filtra o painel por esse indicador). */
  onClick?: () => void;
  /** Texto do tooltip do ícone "i" ao lado do rótulo. */
  info?: string;
  className?: string;
}

/** Cartão de indicador do painel: rótulo, valor grande tabular, subtexto, ícone colorido. */
export function CartaoDeIndicador({
  rotulo,
  valor,
  subtexto,
  icone,
  tom = "destaque",
  selecionado = false,
  onClick,
  info,
  className,
}: CartaoDeIndicadorProps) {
  const classes = cn(
    "flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4 text-left shadow-card",
    selecionado ? "border-primary" : "border-transparent",
    onClick && "cursor-pointer outline-none transition-shadow hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const corpo = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <span className="truncate">{rotulo}</span>
        {info && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} role="img" aria-label={info} className="flex text-muted-foreground">
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{info}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tabular-nums text-foreground">{valor}</p>
          {subtexto && <p className="truncate text-xs text-muted-foreground">{subtexto}</p>}
        </div>
        {icone && <span className={cn("flex shrink-0 [&>svg]:h-5 [&>svg]:w-5", TONS_DO_ICONE[tom])}>{icone}</span>}
      </div>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={selecionado} className={classes}>
      {corpo}
    </button>
  ) : (
    <div className={classes} data-selecionado={selecionado || undefined}>
      {corpo}
    </div>
  );
}

/** Grade responsiva: 1 coluna no celular, 2 no médio, 5 no largo. */
export function GradeDeIndicadores({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5", className)}>{children}</div>;
}
