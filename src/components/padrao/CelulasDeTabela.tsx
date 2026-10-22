import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* ---------- Avatar pastel ---------- */

/** Matizes (graus HSL) da paleta pastel; espaçados para nomes diferentes parecerem diferentes. */
const MATIZES = [350, 20, 45, 90, 150, 185, 215, 260, 290, 320];

/**
 * Cor estável derivada do nome: mesmo nome, mesma cor, em qualquer tela e sessão.
 * Fundo claro e texto escuro do mesmo matiz (contraste > 4.5:1); como o fundo é
 * sempre claro, a combinação continua legível dentro do tema escuro.
 */
export function corPastel(nome: string): { fundo: string; texto: string } {
  let h = 0;
  for (const ch of nome.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const matiz = MATIZES[h % MATIZES.length];
  return { fundo: `hsl(${matiz} 80% 92%)`, texto: `hsl(${matiz} 60% 30%)` };
}

export interface CelulaDeNomeProps {
  nome: string;
  /** Linha pequena de apoio; aceita nós (ex.: valor em verde). */
  apoio?: React.ReactNode;
  className?: string;
}

/** Avatar circular com a inicial + nome em negrito (truncado) + apoio opcional. */
export function CelulaDeNome({ nome, apoio, className }: CelulaDeNomeProps) {
  const cor = corPastel(nome);
  const inicial = nome.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        data-avatar
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{ backgroundColor: cor.fundo, color: cor.texto }}
      >
        {inicial}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground" title={nome}>
          {nome}
        </p>
        {apoio && <p className="truncate text-label text-muted-foreground">{apoio}</p>}
      </div>
    </div>
  );
}

/* ---------- Selo, métrica, anel ---------- */

export interface SeloDeTipoProps {
  icone?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Pílula azul-clara com ícone, ex.: "Pessoa". */
export function SeloDeTipo({ icone, children, className }: SeloDeTipoProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary",
        className,
      )}
    >
      {icone && <span className="flex [&>svg]:h-3 [&>svg]:w-3">{icone}</span>}
      {children}
    </span>
  );
}

const TONS_DO_TEXTO = {
  neutro: "text-foreground",
  positivo: "text-success",
  negativo: "text-destructive",
  alerta: "text-warning",
} as const;

export interface MetricaProps {
  rotulo: string;
  valor: React.ReactNode;
  tom?: keyof typeof TONS_DO_TEXTO;
  className?: string;
}

/** Rótulo pequeno em cima, valor embaixo. */
export function Metrica({ rotulo, valor, tom = "neutro", className }: MetricaProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-label text-muted-foreground">{rotulo}</span>
      <span className={cn("text-sm font-semibold tabular-nums", TONS_DO_TEXTO[tom])}>{valor}</span>
    </div>
  );
}

const TONS_DO_ANEL = {
  sucesso: "text-success",
  neutro: "text-muted-foreground",
  alerta: "text-warning",
  perigo: "text-destructive",
  destaque: "text-primary",
} as const;

export interface AnelDeContagemProps {
  valor: number;
  rotulo: string;
  tom?: keyof typeof TONS_DO_ANEL;
  className?: string;
}

/**
 * Anel com o número dentro e o rótulo embaixo.
 * O traçado é um círculo desenhado a partir do topo (caminho começa em 12h), em
 * vez de girar o elemento, para não depender de CSS de movimento.
 */
export function AnelDeContagem({ valor, rotulo, tom = "sucesso", className }: AnelDeContagemProps) {
  return (
    <div className={cn("flex flex-col items-center gap-0.5", TONS_DO_ANEL[tom], className)}>
      <span className="relative flex h-9 w-9 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" aria-hidden="true" fill="none">
          <path d="M18 2.5 A15.5 15.5 0 1 1 17.99 2.5" stroke="currentColor" strokeWidth="2.5" />
        </svg>
        <span className="text-sm font-semibold tabular-nums text-foreground">{valor}</span>
      </span>
      <span className="text-label text-muted-foreground">{rotulo}</span>
    </div>
  );
}

/* ---------- Menu "…" ---------- */

export interface AcaoDeLinha {
  rotulo: string;
  onSelect: () => void;
  icone?: React.ReactNode;
  destrutiva?: boolean;
}

export interface MenuDeLinhaProps {
  acoes: AcaoDeLinha[];
  rotulo?: string;
  className?: string;
}

/** Botão "…" que abre as ações da linha; não propaga o clique para a linha. */
export function MenuDeLinha({ acoes, rotulo = "Mais ações", className }: MenuDeLinhaProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {acoes.map((a) => (
          <DropdownMenuItem
            key={a.rotulo}
            onSelect={a.onSelect}
            className={cn("gap-2", a.destrutiva && "text-destructive focus:text-destructive")}
          >
            {a.icone}
            {a.rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
