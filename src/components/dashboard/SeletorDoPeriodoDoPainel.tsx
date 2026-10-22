/**
 * Seletor de período do painel, com o mesmo gatilho do `SeletorDePeriodo` do
 * padrão (ícone de calendário + intervalo). O painel trabalha com períodos
 * nomeados (hoje, esta semana, este mês...) e comparação, que as funções SQL
 * conhecem; um intervalo livre não tem como ser calculado por elas, por isso o
 * popover lista os períodos e a comparação em vez de dois campos de data.
 */
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SDR_PERIOD_LABELS, type SdrPeriod, type SdrComparacao } from "@/hooks/useSdrMetrics";

const item = "flex h-8 w-full items-center rounded-md px-2.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

export function SeletorDoPeriodoDoPainel({
  periodo, periodos, onPeriodo, comparacao, comparacoes, rotuloDaComparacao, onComparacao, intervalo,
}: {
  periodo: SdrPeriod;
  periodos: SdrPeriod[];
  onPeriodo: (p: SdrPeriod) => void;
  comparacao: SdrComparacao;
  comparacoes: SdrComparacao[];
  rotuloDaComparacao: (c: SdrComparacao) => string;
  onComparacao: (c: SdrComparacao) => void;
  /** "1 a 22 de out" etc.; nulo em "Todo o período". */
  intervalo: string | null;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Período do painel"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {SDR_PERIOD_LABELS[periodo]}
          {intervalo && <span className="text-muted-foreground">{intervalo}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2 p-2 shadow-pop">
        <div role="group" aria-label="Período">
          {periodos.map((p) => (
            <button key={p} type="button" aria-pressed={p === periodo} onClick={() => onPeriodo(p)} className={cn(item, p === periodo && "bg-primary/10 font-medium text-primary")}>
              {SDR_PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Comparar com" className="border-t border-border pt-2">
          <p className="px-2.5 pb-1 text-xs text-muted-foreground">Comparar com</p>
          {comparacoes.map((c) => (
            <button key={c} type="button" aria-pressed={c === comparacao} onClick={() => onComparacao(c)} className={cn(item, c === comparacao && "bg-primary/10 font-medium text-primary")}>
              {rotuloDaComparacao(c)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
