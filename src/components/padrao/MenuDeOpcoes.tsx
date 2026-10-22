import * as React from "react";
import { Check } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Opcao {
  valor: string;
  rotulo: string;
  icone?: React.ReactNode;
}

interface MenuDeOpcoesProps {
  /** O botão que abre o menu (recebe `asChild`). */
  gatilho: React.ReactNode;
  opcoes: Opcao[];
  valor?: string;
  onChange?: (valor: string) => void;
  rotuloDaLista: string;
  alinhamento?: "start" | "center" | "end";
}

/**
 * Menu de escolha única compartilhado por SeletorTracejado e ChipDeEstado.
 *
 * Usa Popover (e não DropdownMenu) porque o gatilho precisa continuar sendo um
 * botão comum e porque a escolha é um estado, não uma ação: o item marcado é
 * anunciado por `aria-selected` num `listbox`.
 */
export function MenuDeOpcoes({
  gatilho,
  opcoes,
  valor,
  onChange,
  rotuloDaLista,
  alinhamento = "start",
}: MenuDeOpcoesProps) {
  const [aberto, setAberto] = React.useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
      <PopoverContent align={alinhamento} className="w-auto min-w-40 p-1 shadow-pop">
        <div role="listbox" aria-label={rotuloDaLista} className="flex flex-col">
          {opcoes.map((o) => {
            const ativa = o.valor === valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="option"
                aria-selected={ativa}
                onClick={() => {
                  onChange?.(o.valor);
                  setAberto(false);
                }}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-foreground outline-none hover:bg-accent focus-visible:bg-accent",
                  ativa && "font-medium text-primary",
                )}
              >
                {o.icone}
                <span className="flex-1">{o.rotulo}</span>
                {ativa && <Check className="h-4 w-4" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
