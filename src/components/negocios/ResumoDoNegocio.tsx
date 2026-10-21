import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { pluralizar } from "@/lib/formato";
import { abreviarEtapa, nomeDaAtividade, quandoCompleto, type ProximaAtividade } from "@/components/negocios/sinais";

/**
 * As peças do resumo de um negócio, no desenho do painel lateral do V1.
 *
 * O painel do quadro e a página do negócio mostram o MESMO resumo -- trilha de
 * etapas, fatos, alerta de atraso, ações rápidas. Escritos duas vezes, os dois
 * divergiriam no primeiro ajuste, como os quatro selos de situação divergiram
 * antes de `SeloDeNegocio`.
 */

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

/* ── Trilha de etapas ──────────────────────────────────────────────────────── */

/**
 * A ponta de seta é `clip-path`, e não `transform`/`rotate` num pseudo-elemento:
 * transform cria bloco de contenção para `position: fixed`, e é exatamente a
 * armadilha que fazia o DragOverlay fugir do cursor (CLAUDE.md). Recorte não
 * tem esse efeito.
 */
const SETA_PRIMEIRA = "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)";
const SETA = "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)";

export function TrilhaDeEtapas({
  etapas, atualId, status, onEscolher,
}: {
  /** Já em ordem e só do funil deste negócio. */
  etapas: Stage[];
  atualId: string | null;
  status: string | null;
  /** Ausente, ou negócio encerrado: a trilha só informa. */
  onEscolher?: (stageId: string) => void;
}) {
  const atual = etapas.findIndex((e) => e.id === atualId);
  const aberto = (status ?? "open") === "open";
  const clicavel = aberto && !!onEscolher;
  // Encerrado pinta a trilha inteira com o desfecho: o progresso deixou de
  // ser a informação, o resultado é que importa.
  const corFeita = status === "won" ? "bg-success text-success-foreground"
    : status === "lost" ? "bg-destructive text-destructive-foreground"
    : "bg-primary text-primary-foreground";

  return (
    <ol aria-label="Etapas do funil" className="flex w-full gap-1">
      {etapas.map((e, i) => {
        const feita = i < atual;
        const corrente = i === atual;
        const conteudo = feita
          ? <Check aria-hidden="true" className="h-3.5 w-3.5" />
          // Só a etapa atual leva o nome inteiro; as outras, abreviadas, com o
          // nome completo no `title` do item.
          : <span className="truncate">{corrente ? e.name : abreviarEtapa(e.name)}</span>;
        const classe = cn(
          "flex h-8 w-full min-w-0 items-center justify-center pl-3 pr-2 text-xs font-medium transition-colors",
          feita || corrente ? corFeita : "bg-muted text-muted-foreground",
          corrente && "font-semibold",
          clicavel && !corrente && "hover:bg-accent hover:text-accent-foreground",
        );
        const estilo = { clipPath: i === 0 ? SETA_PRIMEIRA : SETA };
        return (
          // A etapa corrente ganha mais espaço: é a única cujo nome importa
          // ler inteiro, e as outras viram setas curtas.
          <li key={e.id} className={cn("min-w-0", corrente ? "flex-[1.6]" : "flex-1")} title={e.name}>
            {clicavel && !corrente ? (
              <button type="button" onClick={() => onEscolher!(e.id)} className={classe} style={estilo}
                aria-label={`Mover para ${e.name}`}>
                {conteudo}
              </button>
            ) : (
              <span className={classe} style={estilo} aria-current={corrente ? "step" : undefined}>
                {conteudo}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Fatos ─────────────────────────────────────────────────────────────────── */

export function FatosDoNegocio({ fatos }: { fatos: { rotulo: string; valor: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {fatos.map((f) => (
        <div key={f.rotulo} className="min-w-0">
          <dt className="truncate text-label text-muted-foreground">{f.rotulo}</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">{f.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Alerta de atraso ──────────────────────────────────────────────────────── */

export function AlertaDeAtraso({ proxima, onReagendar }: {
  proxima: ProximaAtividade;
  onReagendar?: () => void;
}) {
  const { atividade, diasDeAtraso } = proxima;
  const quanto = diasDeAtraso === 0 ? "desde hoje" : `${diasDeAtraso} ${pluralizar(diasDeAtraso, "dia")}`;
  return (
    <div role="status" title={atividade.title ?? undefined}
      className="flex items-center gap-3 rounded-lg bg-destructive-soft py-2 pl-3.5 pr-2">
      <Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight text-destructive">{nomeDaAtividade(atividade)} atrasada {quanto}</p>
        <p className="mt-0.5 truncate text-xs leading-tight text-destructive">Era {quandoCompleto(atividade.due_date!)}</p>
      </div>
      {onReagendar && (
        <Button size="sm" variant="outline" onClick={onReagendar}
          className="shrink-0 border-transparent bg-card font-semibold text-destructive shadow-sm hover:bg-card hover:text-destructive">
          Reagendar
        </Button>
      )}
    </div>
  );
}

/* ── Ações rápidas ─────────────────────────────────────────────────────────── */

export type AcaoRapida = {
  chave: string;
  rotulo: string;
  Icone: LucideIcon;
  /** Explica o que acontece, ou por que está apagada. */
  titulo: string;
  onClick?: () => void;
  /** Rota interna: vira <Link>, e o botão do meio do mouse abre outra aba. */
  para?: string;
  desabilitado?: boolean;
};

/**
 * A fileira de atalhos do rodapé do painel.
 *
 * Só entra aqui ação que JÁ EXISTE no CRM: cada tela monta a lista ligando o
 * que tem. Ação sem destino aparece apagada com o motivo no `title` -- "Sem
 * e-mail no contato" ensina mais que um botão sumido.
 */
export function AcoesRapidas({ acoes }: { acoes: AcaoRapida[] }) {
  const base = "flex h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card text-label font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="grid grid-cols-5 gap-2">
      {acoes.map(({ chave, rotulo, Icone, titulo, onClick, para, desabilitado }) => {
        const miolo = (<><Icone aria-hidden="true" className="h-4 w-4 text-foreground" /><span className="truncate">{rotulo}</span></>);
        if (para && !desabilitado) {
          return <Link key={chave} to={para} title={titulo} className={base}>{miolo}</Link>;
        }
        return (
          <button key={chave} type="button" title={titulo} aria-label={titulo} disabled={desabilitado} onClick={onClick}
            className={cn(base, "disabled:pointer-events-none disabled:opacity-40")}>
            {miolo}
          </button>
        );
      })}
    </div>
  );
}
