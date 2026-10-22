import * as React from "react";
import { CalendarDays } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Periodo {
  de: Date;
  ate: Date;
}

const FORMATO = new Intl.DateTimeFormat("pt-BR", { month: "short", day: "numeric", year: "numeric" });

/** "out 15, 2026" — mês curto sem o ponto que o pt-BR acrescenta ("out."). */
function formatarData(d: Date): string {
  const p = Object.fromEntries(FORMATO.formatToParts(d).map((x) => [x.type, x.value]));
  return `${String(p.month).replace(".", "")} ${p.day}, ${p.year}`;
}

export function formatarIntervalo({ de, ate }: Periodo): string {
  return `${formatarData(de)} - ${formatarData(ate)}`;
}

/** yyyy-mm-dd no fuso LOCAL (toISOString usaria UTC e erraria o dia à noite). */
function paraCampo(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

function doCampo(s: string): Date | null {
  const [a, m, d] = s.split("-").map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
}

const diasAtras = (base: Date, n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() - n);

export interface SeletorDePeriodoProps {
  valor: Periodo;
  onChange: (p: Periodo) => void;
  /** "Hoje" para os atalhos; injetável para teste. */
  hoje?: Date;
  className?: string;
}

/** Botão com o intervalo + popover com atalhos e dois campos de data. */
export function SeletorDePeriodo({ valor, onChange, hoje, className }: SeletorDePeriodoProps) {
  const [aberto, setAberto] = React.useState(false);
  const base = hoje ?? new Date();

  const atalhos: { rotulo: string; periodo: () => Periodo }[] = [
    { rotulo: "Hoje", periodo: () => ({ de: diasAtras(base, 0), ate: diasAtras(base, 0) }) },
    { rotulo: "7 dias", periodo: () => ({ de: diasAtras(base, 7), ate: diasAtras(base, 0) }) },
    { rotulo: "30 dias", periodo: () => ({ de: diasAtras(base, 30), ate: diasAtras(base, 0) }) },
    {
      rotulo: "Este mês",
      periodo: () => ({ de: new Date(base.getFullYear(), base.getMonth(), 1), ate: diasAtras(base, 0) }),
    },
    {
      rotulo: "Mês anterior",
      periodo: () => ({
        de: new Date(base.getFullYear(), base.getMonth() - 1, 1),
        ate: new Date(base.getFullYear(), base.getMonth(), 0),
      }),
    },
  ];

  const aplicar = (p: Periodo) => {
    onChange(p);
    setAberto(false);
  };

  const campo = "h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Período"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {formatarIntervalo(valor)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3 shadow-pop">
        <div className="flex flex-wrap gap-1.5">
          {atalhos.map((a) => (
            <button
              key={a.rotulo}
              type="button"
              onClick={() => aplicar(a.periodo())}
              className="h-8 rounded-md border border-input px-2.5 text-xs font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            De
            <input
              type="date"
              className={campo}
              value={paraCampo(valor.de)}
              max={paraCampo(valor.ate)}
              onChange={(e) => {
                const d = doCampo(e.target.value);
                if (d) onChange({ de: d, ate: valor.ate });
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Até
            <input
              type="date"
              className={campo}
              value={paraCampo(valor.ate)}
              min={paraCampo(valor.de)}
              onChange={(e) => {
                const d = doCampo(e.target.value);
                if (d) onChange({ de: valor.de, ate: d });
              }}
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
