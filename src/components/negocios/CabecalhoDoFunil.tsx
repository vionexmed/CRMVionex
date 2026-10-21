import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarNumero } from "@/lib/formato";
import { Iniciais } from "@/components/layout/ListaV1";

/**
 * Funis como pílulas com contagem, no lugar do select "Funil".
 *
 * Com o select, trocar de funil eram dois cliques e o número de cada um ficava
 * escondido. Com as pílulas, "tem algo no outro funil?" se responde sem
 * clicar -- o mesmo raciocínio das abas de visão das listas.
 *
 * A contagem é de negócios ABERTOS: é o que o quadro mostra em colunas, e o
 * mesmo número do indicador "Em aberto" logo abaixo.
 */
export function SeletorDeFunil({ funis, valor, onChange, contagens, linkNovoFunil }: {
  funis: { id: string; name: string }[];
  valor: string;
  onChange: (id: string) => void;
  /** Ausente para um funil: a contagem não aparece (ainda carregando). */
  contagens?: Map<string, number>;
  /**
   * Para onde leva "+ Funil". Ausente: o botão não aparece. Criar funil existe
   * só em Configurações (admin), então não há por que oferecer a quem não pode.
   */
  linkNovoFunil?: string;
}) {
  return (
    <div role="group" aria-label="Funis" className="flex min-w-0 flex-wrap items-center gap-2">
      {funis.map((f) => {
        const ativo = f.id === valor;
        const n = contagens?.get(f.id);
        return (
          <button key={f.id} type="button" aria-pressed={ativo} onClick={() => onChange(f.id)}
            className={cn(
              "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              ativo ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-surface-2",
            )}>
            {f.name}
            {n !== undefined && (
              <span className={cn(
                "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                ativo ? "bg-primary-foreground/20 text-primary-foreground" : "text-muted-foreground",
              )}>
                {formatarNumero(n)}
              </span>
            )}
          </button>
        );
      })}
      {linkNovoFunil && (
        <Link to={linkNovoFunil}
          className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-input px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />Funil
        </Link>
      )}
    </div>
  );
}

/**
 * Quem trabalha o funil: iniciais da equipe, sobrepostas.
 *
 * Só informa -- filtrar por pessoa é o chip "Responsável", e duas portas para o
 * mesmo filtro com aparências diferentes confundiriam qual está ligada. O nome
 * completo de todos vai no `title`, já que as iniciais sozinhas não identificam.
 */
export function TimeDoFunil({ membros, maximo = 4 }: {
  membros: { id: string; name: string | null; email?: string | null }[];
  maximo?: number;
}) {
  if (membros.length === 0) return null;
  const visiveis = membros.slice(0, maximo);
  const resto = membros.length - visiveis.length;
  const nomes = membros.map((m) => m.name || m.email || "Sem nome").join(", ");
  return (
    <div title={nomes} aria-label={`Time: ${nomes}`}
      className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-card pl-1.5 pr-3">
      <div className="flex -space-x-1.5">
        {visiveis.map((m) => (
          <Iniciais key={m.id} nome={m.name || m.email} tamanho="sm" className="ring-2 ring-card" />
        ))}
        {resto > 0 && (
          <span aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-label font-semibold text-muted-foreground ring-2 ring-card">
            +{resto}
          </span>
        )}
      </div>
      <span className="text-sm font-medium text-foreground">Time</span>
    </div>
  );
}
