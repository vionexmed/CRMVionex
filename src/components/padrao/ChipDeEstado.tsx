
import { cn } from "@/lib/utils";
import { MenuDeOpcoes, type Opcao } from "./MenuDeOpcoes";

export interface ChipDeEstadoProps {
  /** Parte escura, ex.: "Ordenação". */
  rotulo: string;
  /** Valor atual (casa com `opcoes[].valor`). */
  valor: string;
  opcoes: Opcao[];
  onChange: (valor: string) => void;
  className?: string;
}

/** Pílula com borda: rótulo escuro + valor na cor de destaque; abre o menu de opções. */
export function ChipDeEstado({ rotulo, valor, opcoes, onChange, className }: ChipDeEstadoProps) {
  const atual = opcoes.find((o) => o.valor === valor)?.rotulo ?? valor;
  return (
    <MenuDeOpcoes
      rotuloDaLista={rotulo}
      opcoes={opcoes}
      valor={valor}
      onChange={onChange}
      gatilho={
        <button
          type="button"
          aria-haspopup="listbox"
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-full border border-input bg-card px-3 text-xs outline-none",
            "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <span className="text-foreground">{rotulo}</span>
          <span className="font-medium text-primary">{atual}</span>
        </button>
      }
    />
  );
}
