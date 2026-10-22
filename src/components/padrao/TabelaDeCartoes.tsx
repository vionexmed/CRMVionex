import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Coluna extra, prepended quando a tabela tem checkbox. */
const COLUNA_DO_CHECKBOX = "2.5rem";

interface Contexto {
  grade: string;
  larguraMinima: number;
  comCheckbox: boolean;
}
const TabelaContext = React.createContext<Contexto>({ grade: "1fr", larguraMinima: 0, comCheckbox: false });

export interface TabelaDeCartoesProps {
  /** CSS grid-template-columns das colunas de dados, ex.: "2fr 1fr 1fr 8rem". */
  colunas: string;
  /** Reserva a primeira coluna (2.5rem) para o checkbox de cada linha. */
  comCheckbox?: boolean;
  /** Abaixo dessa largura (px) a tabela rola na horizontal, dentro do contêiner. */
  larguraMinima?: number;
  rotulo?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Tabela em cartões: o cabeçalho é um cartão e cada registro é outro, separados
 * por espaço vertical.
 *
 * A rolagem horizontal fica NESTE contêiner (`overflow-x-auto`) para que numa
 * tela estreita a página não ganhe barra de rolagem própria. O espaço de 4px
 * em volta (`p-1`) existe para a sombra dos cartões não ser cortada pelo overflow.
 */
function Raiz({ colunas, comCheckbox = false, larguraMinima = 880, rotulo, children, className }: TabelaDeCartoesProps) {
  const grade = comCheckbox ? `${COLUNA_DO_CHECKBOX} ${colunas}` : colunas;
  const valor = React.useMemo(() => ({ grade, larguraMinima, comCheckbox }), [grade, larguraMinima, comCheckbox]);
  return (
    <TabelaContext.Provider value={valor}>
      <div className={cn("w-full overflow-x-auto p-1", className)} data-tabela-de-cartoes>
        <div role="table" aria-label={rotulo} className="flex flex-col gap-2" style={{ minWidth: larguraMinima }}>
          {children}
        </div>
      </div>
    </TabelaContext.Provider>
  );
}

export interface CabecalhoProps {
  /** Um rótulo por coluna de dados (o checkbox, se houver, fica vazio). */
  rotulos: React.ReactNode[];
  className?: string;
}

function Cabecalho({ rotulos, className }: CabecalhoProps) {
  const { grade, comCheckbox } = React.useContext(TabelaContext);
  return (
    <div
      role="row"
      className={cn("grid items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground shadow-card", className)}
      style={{ gridTemplateColumns: grade }}
    >
      {comCheckbox && <div role="columnheader" aria-label="Seleção" />}
      {rotulos.map((r, i) => (
        <div key={i} role="columnheader" className="min-w-0 truncate">
          {r}
        </div>
      ))}
    </div>
  );
}

export interface LinhaProps {
  children: React.ReactNode;
  selecionada?: boolean;
  /** Torna a linha clicável (e acessível por Enter/Espaço). */
  onClick?: () => void;
  /** Só tem efeito se a tabela foi criada com `comCheckbox`. */
  onSelecionadaChange?: (selecionada: boolean) => void;
  rotuloDoCheckbox?: string;
  className?: string;
}

function Linha({ children, selecionada = false, onClick, onSelecionadaChange, rotuloDoCheckbox = "Selecionar linha", className }: LinhaProps) {
  const { grade, comCheckbox } = React.useContext(TabelaContext);
  const clicavel = !!onClick;
  return (
    <div
      role="row"
      aria-selected={comCheckbox || clicavel ? selecionada : undefined}
      data-selecionada={selecionada || undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!clicavel || e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "grid items-center gap-3 rounded-lg border border-transparent bg-card px-4 py-3 shadow-card transition-shadow hover:shadow-card-hover",
        clicavel && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selecionada && "border-primary",
        className,
      )}
      style={{ gridTemplateColumns: grade }}
    >
      {comCheckbox && (
        <div role="cell" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selecionada}
            onCheckedChange={(v) => onSelecionadaChange?.(v === true)}
            aria-label={rotuloDoCheckbox}
          />
        </div>
      )}
      {React.Children.map(children, (c) => (c == null || c === false ? null : <div role="cell" className="min-w-0">{c}</div>))}
    </div>
  );
}

export const TabelaDeCartoes = Object.assign(Raiz, { Cabecalho, Linha });
