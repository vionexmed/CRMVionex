/**
 * A métrica escolhida na faixa, dia a dia, contra o período anterior.
 *
 * Era um gráfico de três séries (leads, abordagens, respostas) sem comparação.
 * Três linhas de grandezas diferentes no mesmo eixo respondem mal às duas
 * perguntas que se faz olhando um painel: "como está indo?" e "está melhor que
 * antes?". Uma linha só -- a do número que a pessoa clicou -- com o período
 * anterior tracejado atrás dela responde as duas.
 *
 * SVG puro, como os outros primitivos de `svg/`: o recharts saiu do projeto
 * (ver peso-inicial.test). O desenho é esticado (`preserveAspectRatio="none"`),
 * então TUDO que não pode deformar -- marcador, rótulos, dica -- é HTML por
 * cima, posicionado em porcentagem.
 *
 * Cores só por token (`--primary`, `--muted-foreground`): a cor de destaque é
 * trocável e o tema escuro redefine as duas. E vão em `style`, não em atributo
 * de apresentação, porque `var()` em atributo SVG não é garantido.
 */
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatarNumero, pluralizar } from "@/lib/formato";
import { useHoverTooltip } from "./svg/useHoverTooltip";
import { dataDoDia, diaComSemana, diaCurto } from "./periodo-do-painel";

export type PontoDoDia = { dia: string; valor: number };

/** Um teto "redondo" para o eixo: 21 vira 25, 340 vira 400. */
function tetoDoEixo(max: number): { teto: number; passo: number } {
  if (max <= 0) return { teto: 4, passo: 1 };
  const bruto = max / 5;
  const ordem = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * ordem).find((p) => p >= bruto) ?? 10 * ordem;
  const passoInteiro = Math.max(1, Math.round(passo));
  return { teto: Math.ceil(max / passoInteiro) * passoInteiro, passo: passoInteiro };
}

function caminho(valores: number[], teto: number, total: number, fechar: boolean): string {
  if (valores.length < 2) return "";
  const x = (i: number) => (i / (total - 1)) * 100;
  const y = (v: number) => 100 - (v / teto) * 100;
  const linha = valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  return fechar ? `${linha} L${x(valores.length - 1).toFixed(2)},100 L0,100 Z` : linha;
}

export function GraficoEvolucao({
  titulo,
  unidade,
  pontos,
  anterior,
  legendaAtual,
  legendaAnterior,
  rotuloComparacao,
  projecao,
  acao,
  altura = 240,
}: {
  titulo: string;
  /** Singular e plural do que se conta: "lead"/"leads". */
  unidade: { singular: string; plural: string };
  /** Só os dias que já aconteceram: dia futuro com zero leria como queda. */
  pontos: PontoDoDia[];
  /** Mesmo dia do período anterior, alinhado por posição. null sem comparação. */
  anterior: number[] | null;
  legendaAtual: string;
  legendaAnterior: string | null;
  /** "setembro", para a dica: "setembro: 11 (+18%)". */
  rotuloComparacao: string | null;
  /** Dias do período inteiro, quando ele ainda está correndo. */
  projecao: { diasNoPeriodo: number; nomeDoPeriodo: string } | null;
  acao?: ReactNode;
  altura?: number;
}) {
  const idGrad = useId().replace(/:/g, "");
  const total = pontos.length;
  const { hover, aoMover, aoSair } = useHoverTooltip(total);

  const valores = pontos.map((p) => p.valor);
  const anteriorVisivel = anterior ? anterior.slice(0, total) : null;
  const { teto, passo } = tetoDoEixo(Math.max(0, ...valores, ...(anteriorVisivel ?? [])));
  const marcas = Array.from({ length: teto / passo + 1 }, (_, i) => teto - i * passo);

  const soma = valores.reduce((s, v) => s + v, 0);
  const media = total > 0 ? soma / total : 0;
  const melhor = pontos.reduce<PontoDoDia | null>((m, p) => (!m || p.valor > m.valor ? p : m), null);
  const nome = (n: number) => pluralizar(Math.round(n), unidade.singular, unidade.plural);

  // Rótulos ralos: com 30 dias, mostrar todos vira borrão.
  const passoRotulo = Math.max(1, Math.ceil(total / 5));
  const xDe = (i: number) => (total > 1 ? (i / (total - 1)) * 100 : 50);
  const yDe = (v: number) => 100 - (v / teto) * 100;

  const iHover = hover?.indice ?? null;
  const valorHover = iHover !== null ? valores[iHover] : null;
  const anteriorHover = iHover !== null && anteriorVisivel ? anteriorVisivel[iHover] ?? null : null;
  const variacaoHover = valorHover !== null && anteriorHover !== null && anteriorHover > 0
    ? Math.round(((valorHover - anteriorHover) / anteriorHover) * 100)
    : null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[var(--respiro)] pt-[var(--respiro)]">
        <p className="text-sm font-semibold">{titulo}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />
            {legendaAtual}
          </span>
          {legendaAnterior && anteriorVisivel && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t-2 border-dashed border-muted-foreground" />
              {legendaAnterior}
            </span>
          )}
          {acao}
        </div>
      </div>

      {total < 2 ? (
        <p className="mx-[var(--respiro)] my-6 border-l-2 border-border pl-4 text-xs text-muted-foreground">
          O gráfico aparece a partir do segundo dia do período.
        </p>
      ) : (
        <div className="flex gap-2 px-[var(--respiro)] pb-2 pt-4">
          {/* Eixo Y fora do SVG: não distorce com preserveAspectRatio="none". */}
          <div className="relative w-7 shrink-0 text-right text-label tabular-nums text-muted-foreground" style={{ height: altura }} aria-hidden>
            {marcas.map((m) => (
              <span key={m} className="absolute right-0 -translate-y-1/2" style={{ top: `${yDe(m)}%` }}>
                {formatarNumero(m)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="relative"
              style={{ height: altura }}
              onMouseMove={aoMover}
              onMouseLeave={aoSair}
              onTouchMove={aoMover}
              onTouchEnd={aoSair}
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-full w-full overflow-visible"
                role="img"
                aria-label={`${titulo}: ${formatarNumero(soma)} no total, média de ${formatarNumero(Math.round(media))} por dia`}
              >
                <defs>
                  <linearGradient id={`area-${idGrad}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 0.16 }} />
                    <stop offset="100%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 0.02 }} />
                  </linearGradient>
                </defs>

                {marcas.map((m) => (
                  <line
                    key={m}
                    x1="0" x2="100" y1={yDe(m)} y2={yDe(m)}
                    vectorEffect="non-scaling-stroke"
                    style={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  />
                ))}

                <path d={caminho(valores, teto, total, true)} style={{ fill: `url(#area-${idGrad})` }} />

                {anteriorVisivel && anteriorVisivel.length > 1 && (
                  <path
                    d={caminho(anteriorVisivel, teto, total, false)}
                    vectorEffect="non-scaling-stroke"
                    style={{ fill: "none", stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5, strokeDasharray: "5 4", strokeLinejoin: "round" }}
                  />
                )}

                <path
                  d={caminho(valores, teto, total, false)}
                  vectorEffect="non-scaling-stroke"
                  style={{ fill: "none", stroke: "hsl(var(--primary))", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }}
                />
              </svg>

              {/* Último ponto: onde o período está agora. */}
              <span
                aria-hidden
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                style={{ left: `${xDe(total - 1)}%`, top: `${yDe(valores[total - 1])}%` }}
              />

              {iHover !== null && valorHover !== null && (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 border-l border-dashed border-muted-foreground"
                    style={{ left: `${xDe(iHover)}%` }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card"
                    style={{ left: `${xDe(iHover)}%`, top: `${yDe(valorHover)}%` }}
                  />
                  {/* A dica é ESCURA nos dois temas: `bg-foreground` inverte com
                      o tema, então ela sempre contrasta com o cartão embaixo. */}
                  <div
                    className={cn(
                      "pointer-events-none absolute top-2 z-10 min-w-[140px] rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-md",
                      iHover > total * 0.6 ? "-translate-x-[calc(100%+12px)]" : "translate-x-3",
                    )}
                    style={{ left: `${xDe(iHover)}%` }}
                  >
                    <p className="opacity-75">{diaComSemana(dataDoDia(pontos[iHover].dia))}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatarNumero(valorHover)} {nome(valorHover)}
                    </p>
                    {rotuloComparacao && anteriorHover !== null && (
                      <p className="opacity-75 tabular-nums">
                        {rotuloComparacao}: {formatarNumero(anteriorHover)}
                        {variacaoHover !== null && ` (${variacaoHover > 0 ? "+" : ""}${variacaoHover}%)`}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="relative mt-2 h-4 text-label tabular-nums text-muted-foreground" aria-hidden>
              {pontos.map((p, i) => {
                const ultimo = i === total - 1;
                if (!ultimo && i % passoRotulo !== 0) return null;
                // O último rótulo encosta na borda e alinha pela direita; um
                // rótulo regular muito perto dele seria encoberto.
                if (!ultimo && total - 1 - i < passoRotulo * 0.75) return null;
                return (
                  <span
                    key={p.dia}
                    className={cn("absolute whitespace-nowrap", i === 0 ? "" : ultimo ? "-translate-x-full" : "-translate-x-1/2")}
                    style={{ left: `${xDe(i)}%` }}
                  >
                    {diaCurto(dataDoDia(p.dia))}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {total > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-border px-[var(--respiro)] py-3 text-xs text-muted-foreground">
          <div className="flex gap-1">
            <dt>Média</dt>
            <dd className="font-semibold text-foreground tabular-nums">
              {formatarNumero(Math.round(media))} por dia
            </dd>
          </div>
          {melhor && melhor.valor > 0 && (
            <div className="flex gap-1">
              <dt>Melhor dia</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {diaCurto(dataDoDia(melhor.dia))} · {formatarNumero(melhor.valor)} {nome(melhor.valor)}
              </dd>
            </div>
          )}
          {/* Projeção é a média dos dias decorridos estendida ao período. Só com
              o período correndo: em período fechado ela seria o próprio total. */}
          {projecao && total < projecao.diasNoPeriodo && (
            <div className="flex gap-1">
              <dt>Projeção do {projecao.nomeDoPeriodo}</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                ≈ {formatarNumero(Math.round(media * projecao.diasNoPeriodo))} {unidade.plural}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
