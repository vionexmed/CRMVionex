import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarNumero } from "@/lib/formato";
import { AvatarDaPessoa } from "@/components/negocios/AvatarDaPessoa";

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
  funis: { id: string; name: string; is_default?: boolean | null }[];
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
  // O padrão primeiro, os outros por nome: a ordem de criação no banco não diz
  // nada a quem lê, e mudaria a posição das pílulas a cada funil novo.
  const ordenados = [...funis].sort((a, b) =>
    Number(!!b.is_default) - Number(!!a.is_default) || a.name.localeCompare(b.name, "pt-BR"));
  return (
    <div role="group" aria-label="Funis" className="flex min-w-0 flex-wrap items-center gap-2">
      {ordenados.map((f) => {
        const ativo = f.id === valor;
        const n = contagens?.get(f.id);
        return (
          <button key={f.id} type="button" aria-pressed={ativo} onClick={() => onChange(f.id)}
            className={cn(
              "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              ativo ? "border-transparent bg-primary font-semibold text-primary-foreground" : "border-border bg-card font-medium text-foreground hover:bg-surface-2",
            )}>
            {f.name}
            {n !== undefined && (
              <span className={cn(
                "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                ativo ? "bg-primary-foreground/20 text-primary-foreground" : "px-0 text-muted-foreground",
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
 * Quem trabalha o funil: as iniciais de quem tem negócio ABERTO nele, de quem
 * tem mais para quem tem menos -- a pilha responde "de quem é este funil?".
 *
 * Só informa -- filtrar por pessoa é o chip "Responsável", e duas portas para o
 * mesmo filtro com aparências diferentes confundiriam qual está ligada. O nome
 * completo de todos vai no `title`, já que as iniciais sozinhas não identificam.
 */
export function TimeDoFunil({ pessoas, tons, maximo = 4 }: {
  /** Já em ordem. */
  pessoas: { id: string; name: string | null; email?: string | null }[];
  /** Tom de cada pessoa, de `tonsDaEquipe`. */
  tons: Map<string, string>;
  maximo?: number;
}) {
  if (pessoas.length === 0) return null;
  // Sem "+N": a pilha mostra os que mais carregam o funil, e o `title` lista
  // todos -- um quinto círculo só com número disputaria com as iniciais.
  const visiveis = pessoas.slice(0, maximo);
  const nomes = pessoas.map((m) => m.name || m.email || "Sem nome").join(", ");
  return (
    <div title={nomes} aria-label={`Time: ${nomes}`}
      className="flex h-[42px] shrink-0 items-center gap-2.5 rounded-lg border border-border bg-card pl-2 pr-3.5 shadow-sm">
      <div className="flex -space-x-1">
        {visiveis.map((m) => (
          <AvatarDaPessoa key={m.id} nome={m.name || m.email} tom={tons.get(m.id)} tamanho="md" className="ring-2 ring-card" />
        ))}
      </div>
      <span className="text-sm font-medium text-foreground">Time</span>
    </div>
  );
}
