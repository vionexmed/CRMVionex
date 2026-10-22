import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Coluna extra, prepended quando a tabela tem checkbox. */
const COLUNA_DO_CHECKBOX = "2.5rem";

interface Contexto {
  grade: string;
  larguraMinima: number;
  comCheckbox: boolean;
  /** A tabela rola por dentro: o cabeçalho fica preso no topo. */
  preencher: boolean;
}
const TabelaContext = React.createContext<Contexto>({ grade: "1fr", larguraMinima: 0, comCheckbox: false, preencher: false });

export interface TabelaDeCartoesProps {
  /** CSS grid-template-columns das colunas de dados, ex.: "2fr 1fr 1fr 8rem". */
  colunas: string;
  /** Reserva a primeira coluna (2.5rem) para o checkbox de cada linha. */
  comCheckbox?: boolean;
  /** Abaixo dessa largura (px) a tabela rola na horizontal, dentro do contêiner. */
  larguraMinima?: number;
  /**
   * A TABELA É A ÚNICA ÁREA DE ROLAGEM da tela: ocupa o espaço que sobra
   * (`flex-1 min-h-0`), rola nos dois eixos por dentro e prende o cabeçalho no
   * topo. Exige que o pai seja um flex-col de altura definida (`Pagina preencher`).
   */
  preencher?: boolean;
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
function Raiz({ colunas, comCheckbox = false, larguraMinima = 880, preencher = false, rotulo, children, className }: TabelaDeCartoesProps) {
  const grade = comCheckbox ? `${COLUNA_DO_CHECKBOX} ${colunas}` : colunas;
  const valor = React.useMemo(() => ({ grade, larguraMinima, comCheckbox, preencher }), [grade, larguraMinima, comCheckbox, preencher]);
  return (
    <TabelaContext.Provider value={valor}>
      <div className={cn("w-full p-1", preencher ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto", className)} data-tabela-de-cartoes>
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
  const { grade, comCheckbox, preencher } = React.useContext(TabelaContext);
  return (
    <div
      role="row"
      className={cn(
        "grid items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground shadow-card [&>*]:min-w-0",
        // Preso no topo enquanto as linhas rolam. A sombra dura na cor do fundo
        // tapa o vão de 8px entre o cabeçalho e a primeira linha, senão os
        // cartões passam visíveis por ali.
        preencher && "sticky top-0 z-10",
        className,
      )}
      style={{ gridTemplateColumns: grade, ...(preencher ? { boxShadow: "var(--shadow-card), 0 8px 0 0 hsl(var(--background))" } : {}) }}
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
        // `[&>*]:min-w-0`: célula nenhuma pode ser mais larga que a própria
        // coluna e invadir a vizinha (conteúdo longo trunca dentro dela).
        "grid items-center gap-3 rounded-lg border border-transparent bg-card px-4 py-3 shadow-card transition-shadow hover:shadow-card-hover [&>*]:min-w-0",
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
