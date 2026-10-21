/**
 * Tile de métrica do painel de SDR.
 *
 * Extraído do markup que estava repetido 6× inline em src/pages/Dashboard.tsx —
 * com 16 métricas, repetir 18 linhas por tile seria inviável.
 *
 * Três estados:
 *  - valor real     → número + variação contra o período anterior;
 *  - sem fonte      → "—" + texto, para métrica que não tem dado no banco;
 *  - não calculável → "—" discreto, quando o período não tem dado (ex.: taxa
 *                     de entrega sem nenhum envio). Não é 0 — 0 seria mentira.
 *
 * VISUAL 01: rótulo pequeno, número grande e a variação AO LADO do número
 * ("144 ▲ 35%"), com a linha de apoio embaixo ("121 pessoas"). O ícone saiu:
 * era a última decoração disputando com o número, e numa faixa de quatro
 * números lidos juntos ele só repetia o que o rótulo já diz.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatarNumero } from "@/lib/formato";
import { formatValue, variation, type StatFormat } from "./formato-da-metrica";

export type { StatFormat };

export type StatAccent = "primary" | "success" | "warning" | "destructive";

export interface StatCardProps {
  label: string;
  value: number | null;
  previous?: number | null;
  format?: StatFormat;
  /** Aceito por compatibilidade com a configuração dos tiles; não é desenhado. */
  icon?: LucideIcon;
  accent?: StatAccent;
  /** Rota ao clicar no tile. Sem isso o tile não é clicável. */
  href?: string;
  /** Explicação/ressalva mostrada no ícone de informação. */
  hint?: string;
  /**
   * Segundo número, na linha de apoio.
   *
   * Existe porque "Abordagens realizadas" conta EVENTOS -- 1 ligação + 1 e-mail
   * para a mesma pessoa dão 2 -- e lido sozinho parece contagem de gente. Os dois
   * números medem coisas diferentes e úteis: toques dizem quanto o time produziu,
   * pessoas dizem quantas portas foram batidas. Mostrar só um obriga a escolher
   * qual pergunta o painel responde.
   */
  secundario?: { valor: number | null; rotulo: string };
  /** Métrica sem fonte de dado no banco — mostra o texto e apaga o tile. */
  noSource?: boolean;
  /** Métrica de fila (valor "agora"), sem comparação com período anterior. */
  noComparison?: boolean;
  /**
   * Dentro de uma faixa: sem moldura própria.
   *
   * Quatro tiles com borda em fila são quatro CAIXAS, e o olho conta caixas
   * antes de ler números. Numa faixa, a moldura é uma só e a divisória entre
   * eles é uma linha -- os quatro números viram uma leitura, não quatro.
   */
  emFaixa?: boolean;
  /** Mantido por compatibilidade; o minigráfico saiu com o gráfico principal. */
  trend?: number[];
  /** Destaque: usado na faixa das métricas principais. */
  emphasis?: boolean;
  /**
   * Métrica escolhida para o gráfico logo abaixo da faixa. Desenha o sublinhado
   * na cor de destaque e anuncia o estado para leitor de tela.
   */
  ativo?: boolean;
  /**
   * Envolve o valor com a prévia que revela as linhas por trás do número, no
   * hover. Recebe o valor já formatado.
   */
  drilldown?: (valor: ReactNode) => ReactNode;
  /**
   * Ação ao clicar no card. Tem precedência sobre `href`.
   *
   * Existe porque um card com drill-down não deve navegar para uma lista que
   * ignora o período — mas também não pode virar área morta com um alvo de
   * clique do tamanho de um dígito.
   */
  onCardClick?: () => void;
}



export function StatCard({
  label,
  value,
  previous,
  format = "number",
  href,
  hint,
  secundario,
  noSource = false,
  noComparison = false,
  emphasis = false,
  emFaixa = false,
  ativo,
  drilldown,
  onCardClick,
}: StatCardProps) {
  const navigate = useNavigate();
  const clickable = (!!onCardClick || !!href) && !noSource;
  const delta = noSource || noComparison ? null : variation(value, previous, format);

  // Para tempo de resposta, cair é bom.
  const lowerIsBetter = format === "duration";
  const positive = delta !== null && (lowerIsBetter ? delta.valor < 0 : delta.valor > 0);

  const valor = (
    <span
      className={cn(
        // `font-semibold` e não bold: no tamanho de 30px o bold fecha os
        // contornos e o número fica pesado demais ao lado do rótulo de 12px.
        "font-heading font-semibold leading-tight tracking-tight tabular-nums",
        emphasis ? "text-3xl" : "text-2xl",
        value === null ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {value === null ? "—" : formatValue(value, format)}
    </span>
  );
  // Sem fonte de dado não há linha para revelar — o "—" não abre prévia.
  const valorComPrevia = drilldown && !noSource && value !== null ? drilldown(valor) : valor;

  const apoio = noSource
    // Texto, não selo. O selo dava a "sem fonte" o mesmo peso visual de um
    // estado do dado -- e chamava atenção para justamente o que não tem o que
    // mostrar.
    ? "sem fonte de dado"
    : value === null
      ? "sem dados no período"
      : secundario && secundario.valor !== null
        ? `${formatValue(secundario.valor, "number")} ${secundario.rotulo}`
        : noComparison
          ? "no momento"
          : null;

  return (
    <div
      className={cn(
        "group relative min-w-0 vx-respiro",
        emFaixa ? "rounded-none border-l border-t border-border" : "vx-elevado rounded-lg bg-card",
        clickable && "cursor-pointer transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        noSource && "opacity-60",
      )}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Ver ${label}` : undefined}
      aria-pressed={clickable && ativo !== undefined ? ativo : undefined}
      onKeyDown={clickable ? (event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          if (onCardClick) onCardClick(); else navigate(href!);
        }
      } : undefined}
      onClick={clickable ? () => (onCardClick ? onCardClick() : navigate(href!)) : undefined}
    >
      {/* O sublinhado da métrica no gráfico. Embaixo, encostado na divisória
          da faixa, como a aba ativa de uma barra de abas -- é o que ela é. */}
      {ativo && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}

      <div className="flex items-start justify-between gap-2">
        <span className={cn("min-w-0 text-xs font-medium leading-snug", ativo ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </span>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Sobre ${label}`}
                onClick={(e) => e.stopPropagation()}
                className="vx-control -my-2 inline-flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-label leading-relaxed">
              {hint}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        {valorComPrevia}
        {delta !== null && (
          <span
            className={cn(
              "whitespace-nowrap text-xs font-semibold tabular-nums",
              delta.valor === 0 ? "text-muted-foreground" : positive ? "text-success" : "text-destructive",
            )}
          >
            {delta.valor > 0 ? "▲ " : delta.valor < 0 ? "▼ " : ""}
            {formatarNumero(Math.abs(delta.valor))}
            {delta.unidade === "%" ? "%" : " p.p."}
            <span className="sr-only"> em relação ao período anterior</span>
          </span>
        )}
      </div>

      {apoio && <p className="mt-1 truncate text-xs text-muted-foreground">{apoio}</p>}
    </div>
  );
}
