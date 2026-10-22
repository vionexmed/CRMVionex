import { useState, type ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatarMoeda, formatarMoedaCurta, formatarMoedaInteira, pluralizar } from "@/lib/formato";
import { mensagemErro } from "@/lib/erro-supabase";
import { useToast } from "@/hooks/use-toast";
import type { ResumoDoFunil } from "@/components/negocios/sinais";
import { useSalvarMetaMensal } from "@/components/negocios/meta-mensal";

const nomeDoMes = new Intl.DateTimeFormat("pt-BR", { month: "long" });

/**
 * Os números do topo do funil, em quatro cartões. O cálculo e as regras de
 * cada um moram em `resumirFunil` (sinais.ts); aqui só se desenha.
 *
 * Cartão sem fonte SOME em vez de mostrar zero: "Previsão ponderada R$ 0" num
 * funil cujas etapas não têm probabilidade afirmaria que nada vai fechar.
 */
export function FaixaDoFunil({ resumo, onVerParados, meta, podeEditarMeta = false }: {
  resumo: ResumoDoFunil;
  /** Liga o filtro "parados há 14+ dias". */
  onVerParados?: () => void;
  /**
   * `organizations.meta_mensal`. `undefined` = o banco não tem a coluna (nada
   * a mostrar nem editar); `null` = sem meta definida (omite o "% da meta").
   */
  meta?: number | null;
  /** Só o dono da organização grava (política de UPDATE de organizations). */
  podeEditarMeta?: boolean;
}) {
  const { aberto, ponderada, ganhosNoMes, taxa, parados14 } = resumo;
  const comValor = aberto.porEtapa.filter((e) => e.total > 0);
  const mes = nomeDoMes.format(new Date());
  const pctMeta = ponderada !== null && meta ? Math.round((ponderada / meta) * 100) : null;
  const maiorSemana = Math.max(...ganhosNoMes.porSemana);

  return (
    <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
      <Cartao>
        <p className="truncate font-medium text-muted-foreground">Em aberto</p>
        <p className="mt-1.5 flex min-w-0 items-baseline gap-2">
          <Valor>{formatarMoedaInteira(aberto.total)}</Valor>
          <span className="truncate text-xs text-muted-foreground">
            {aberto.quantidade} {pluralizar(aberto.quantidade, "negócio")}
          </span>
        </p>
        {aberto.total > 0 && (
          <>
            <div className="mt-2 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
              role="img" aria-label={comValor.map((e) => `${e.nome}: ${formatarMoeda(e.total)}`).join("; ")}>
              {comValor.map((e) => (
                <span key={e.id} title={`${e.nome}: ${formatarMoeda(e.total)}`}
                  className={e.classe} style={{ width: `${(e.total / aberto.total) * 100}%` }} />
              ))}
            </div>
            {aberto.porEtapa.length > 1 && (
              <div className="mt-2.5 flex justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{aberto.porEtapa[0].nome}</span>
                <span className="truncate">{aberto.porEtapa[aberto.porEtapa.length - 1].nome}</span>
              </div>
            )}
          </>
        )}
      </Cartao>

      {ponderada !== null && (
        <Cartao>
          <p className="truncate font-medium text-muted-foreground">Previsão ponderada</p>
          <p className="mt-1.5 flex min-w-0 items-baseline gap-2">
            <Valor>{formatarMoedaInteira(ponderada)}</Valor>
            {pctMeta !== null && (
              <span className="truncate text-xs font-semibold text-primary">{pctMeta}% da meta</span>
            )}
          </p>
          {/* Sem meta, sem trilho: uma barra vazia diria "0% de algo" sem dizer de quê. */}
          {pctMeta !== null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pctMeta)}%` }} />
            </div>
          )}
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">valor × chance da etapa</span>
            {meta !== undefined && (
              podeEditarMeta
                ? <EditarMeta meta={meta} />
                : meta !== null && <span className="shrink-0">meta {formatarMoedaCurta(meta)}</span>
            )}
          </div>
        </Cartao>
      )}

      <Cartao className="flex items-center">
       <div className="flex w-full min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-muted-foreground">Ganhos em {mes}</p>
          <p className="mt-1.5"><Valor className={ganhosNoMes.total > 0 ? "text-success" : undefined}>{formatarMoedaInteira(ganhosNoMes.total)}</Valor></p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {ganhosNoMes.quantidade > 0
              ? `${ganhosNoMes.quantidade} ${pluralizar(ganhosNoMes.quantidade, "negócio")} · ticket ${formatarMoedaInteira(ganhosNoMes.total / ganhosNoMes.quantidade)}`
              : "pela data de fechamento"}
          </p>
        </div>
        {/* Ganhos por semana do mês: a semana de hoje em verde cheio, as
            outras no tom suave. Sem ganho, um traço -- barra de altura zero
            sumiria e o rótulo ficaria solto. */}
        {ganhosNoMes.quantidade > 0 && (
          <div role="img" className="flex shrink-0 items-end gap-1.5"
            aria-label={ganhosNoMes.porSemana.map((v, i) => `S${i + 1}: ${formatarMoedaInteira(v)}`).join("; ")}>
            {ganhosNoMes.porSemana.map((v, i) => (
              <div key={i} className="flex w-[19px] flex-col items-center gap-1.5" title={`S${i + 1}: ${formatarMoeda(v)}`}>
                <div className="flex h-10 w-full items-end">
                  <div className={cn("w-full rounded-sm", i === ganhosNoMes.semanaAtual ? "bg-success" : "bg-success/35")}
                    style={{ height: maiorSemana > 0 && v > 0 ? `${Math.max(8, (v / maiorSemana) * 100)}%` : "2px" }} />
                </div>
                <span className="text-label text-muted-foreground">S{i + 1}</span>
              </div>
            ))}
          </div>
        )}
       </div>
      </Cartao>

      <Cartao className="flex items-center gap-4">
        {taxa && <Anel percentual={taxa.percentual} />}
        <div className="min-w-0">
          <p className="truncate font-medium text-muted-foreground">Taxa de ganho</p>
          {taxa ? (
            <p className="mt-1 text-sm leading-5 text-foreground">
              {Math.round(taxa.percentual / 10)} de cada 10 negócios viram venda
              <span className="sr-only"> ({taxa.ganhos} de {taxa.encerrados} {pluralizar(taxa.encerrados, "encerrado")})</span>
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">nenhum negócio encerrado ainda</p>
          )}
          {parados14 > 0 && onVerParados && (
            <button type="button" onClick={onVerParados}
              className="-mb-1.5 -mt-0.5 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {parados14} {pluralizar(parados14, "parado")} há 14+ dias
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </Cartao>
    </div>
  );
}

function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-[120px] min-w-0 rounded-lg bg-card p-4 shadow-card", className)}>
      {children}
    </div>
  );
}

function Valor({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight text-foreground", className)}>
      {children}
    </span>
  );
}

/** Anel da taxa de ganho. Recorte por traço do SVG, sem transform no wrapper. */
function Anel({ percentual }: { percentual: number }) {
  const r = 26;
  const volta = 2 * Math.PI * r;
  return (
    <div className="relative h-[62px] w-[62px] shrink-0" aria-hidden="true">
      <svg viewBox="0 0 62 62" className="h-full w-full">
        <circle cx="31" cy="31" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle cx="31" cy="31" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className="stroke-primary" strokeDasharray={`${(Math.min(100, percentual) / 100) * volta} ${volta}`}
          style={{ transformOrigin: "center", transformBox: "fill-box", rotate: "-90deg" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-foreground">
        {percentual}%
      </span>
    </div>
  );
}

/**
 * "meta R$ 200 mil" vira o próprio botão de editar, para o dono: a meta é lida
 * no cartão, e é ali que se pensa em mudá-la. Sem meta, "Definir meta".
 */
function EditarMeta({ meta }: { meta: number | null }) {
  const { toast } = useToast();
  const { mutate, isPending } = useSalvarMetaMensal();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");

  const salvar = (valor: number | null) => mutate(valor, {
    onSuccess: () => { toast({ title: valor === null ? "Meta removida" : "Meta mensal salva" }); setAberto(false); },
    onError: (e) => toast({ title: "Não foi possível salvar a meta", description: mensagemErro(e), variant: "destructive" }),
  });
  const numero = Number(texto.replace(/\./g, "").replace(",", "."));

  return (
    <Popover open={aberto} onOpenChange={(o) => { setAberto(o); if (o) setTexto(meta ? String(meta) : ""); }}>
      <PopoverTrigger asChild>
        <button type="button" title="Editar a meta mensal de vendas"
          className={cn("-my-2 inline-flex h-8 shrink-0 items-center rounded hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            meta === null && "font-semibold text-primary")}>
          {meta === null ? "Definir meta" : `meta ${formatarMoedaCurta(meta)}`}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="meta-mensal">Meta de vendas do mês (R$)</Label>
          <Input id="meta-mensal" inputMode="decimal" autoFocus value={texto} placeholder="200000"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && numero > 0) salvar(numero); }} />
          <p className="text-label text-muted-foreground">Vale para a organização inteira.</p>
        </div>
        <div className="flex justify-between gap-2">
          {meta !== null
            ? <Button variant="ghost" size="sm" disabled={isPending} onClick={() => salvar(null)}>Remover</Button>
            : <span />}
          <Button size="sm" disabled={isPending || !(numero > 0)} onClick={() => salvar(numero)}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
