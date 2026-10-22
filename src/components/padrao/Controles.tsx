import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { MenuDeOpcoes, type Opcao } from "./MenuDeOpcoes";

/**
 * Controle SECUNDÁRIO do padrão: borda tracejada (classe `.vx-tracejado`),
 * 36px de altura. O botão primário continua sendo o `Button` azul cheio.
 */
export interface BotaoTracejadoProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icone?: React.ReactNode;
}

export const BotaoTracejado = React.forwardRef<HTMLButtonElement, BotaoTracejadoProps>(
  ({ icone, className, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "vx-tracejado inline-flex h-9 items-center gap-2 rounded-md bg-card px-3 text-sm font-medium text-foreground",
        "outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {icone && <span className="flex shrink-0 items-center [&>svg]:h-4 [&>svg]:w-4">{icone}</span>}
      {children}
    </button>
  ),
);
BotaoTracejado.displayName = "BotaoTracejado";

export interface SeletorTracejadoProps {
  /** Texto fixo do botão, ex.: "Visões". */
  rotulo: string;
  icone?: React.ReactNode;
  opcoes: Opcao[];
  valor?: string;
  onChange?: (valor: string) => void;
  className?: string;
}

/**
 * Botão tracejado com setas de trocar que abre uma lista de opções.
 * O rótulo não muda com a escolha (a opção marcada aparece no menu); quem quiser
 * mostrar o valor atual usa o ChipDeEstado.
 */
export function SeletorTracejado({ rotulo, icone, opcoes, valor, onChange, className }: SeletorTracejadoProps) {
  return (
    <MenuDeOpcoes
      rotuloDaLista={rotulo}
      opcoes={opcoes}
      valor={valor}
      onChange={onChange}
      alinhamento="end"
      gatilho={
        <BotaoTracejado icone={icone} className={cn("min-w-32 justify-between", className)} aria-haspopup="listbox">
          <span className="flex-1 text-left">{rotulo}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </BotaoTracejado>
      }
    />
  );
}

export interface BotaoDeIconeProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatório: o botão não tem texto visível. */
  "aria-label": string;
  icone: React.ReactNode;
}

/** Quadrado de 36px com borda, só ícone. */
export const BotaoDeIcone = React.forwardRef<HTMLButtonElement, BotaoDeIconeProps>(
  ({ icone, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-card text-foreground",
        "outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4",
        className,
      )}
      {...props}
    >
      {icone}
    </button>
  ),
);
BotaoDeIcone.displayName = "BotaoDeIcone";
