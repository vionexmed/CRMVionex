/**
 * Rosca com a fatia de cada responsável. SVG puro (sem biblioteca) e só cores
 * de token: as quatro maiores fatias têm cor própria e o resto vira "Outros".
 */
import { formatarNumero } from "@/lib/formato";

const CORES = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-5))"];
const COR_OUTROS = "hsl(var(--chart-4))";

export type FatiaDeAtendente = { nome: string; valor: number };

export function RoscaPorAtendente({ fatias }: { fatias: FatiaDeAtendente[] }) {
  const ordenadas = [...fatias].filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const principais = ordenadas.slice(0, CORES.length);
  const resto = ordenadas.slice(CORES.length).reduce((s, f) => s + f.valor, 0);
  const partes = resto > 0 ? [...principais, { nome: "Outros", valor: resto }] : principais;
  const total = partes.reduce((s, f) => s + f.valor, 0);
  const raio = 40;
  const circ = 2 * Math.PI * raio;
  let acumulado = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90" role="img" aria-label="Percentual por atendente">
        {partes.map((p, i) => {
          const tamanho = (p.valor / total) * circ;
          const el = (
            <circle
              key={p.nome}
              cx="50" cy="50" r={raio}
              style={{
                fill: "none",
                stroke: p.nome === "Outros" ? COR_OUTROS : CORES[i],
                strokeWidth: 14,
                strokeDasharray: `${tamanho} ${circ - tamanho}`,
                strokeDashoffset: -acumulado,
              }}
            />
          );
          acumulado += tamanho;
          return el;
        })}
      </svg>
      <ul className="min-w-0 space-y-1.5 text-xs">
        {partes.map((p, i) => (
          <li key={p.nome} className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.nome === "Outros" ? COR_OUTROS : CORES[i] }} />
            <span className="truncate text-foreground">{p.nome}</span>
            <span className="ml-auto pl-3 tabular-nums text-muted-foreground">
              {Math.round((p.valor / total) * 100)}% · {formatarNumero(p.valor)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais de ranking (maior = 100%). */
export function RankingEmBarras({ itens, unidade }: { itens: { nome: string; valor: number }[]; unidade: [string, string] }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.nome} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate font-medium text-foreground">{i.nome}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatarNumero(i.valor)} {i.valor === 1 ? unidade[0] : unidade[1]}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-primary/10">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(i.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
