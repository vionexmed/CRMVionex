import { ATIVIDADE_ICONE, ATIVIDADE_ROTULO, type ActivityType } from "@/lib/atividade-tipos";
import { cn } from "@/lib/utils";

/**
 * Fundo suave + cor do ícone por tipo, só com tokens.
 *
 * Ligação é info, e-mail e orçamento são marca (as duas coisas que SAEM para o
 * cliente), reunião pede atenção, nota e tarefa ficam neutras. A distinção fina
 * continua sendo do ÍCONE; a cor só agrupa.
 */
const TOM: Record<ActivityType, string> = {
  call: "bg-info-soft text-info",
  email: "bg-accent text-primary",
  meeting: "bg-warning-soft text-warning",
  note: "bg-neutral-soft text-muted-foreground",
  task: "bg-neutral-soft text-foreground",
  orcamento: "bg-accent text-primary",
};

/** O ícone do tipo num quadrado suave: V1 das listas de atividade. */
export function TipoDeAtividade({ tipo, tamanho = "md", className }: {
  tipo: ActivityType;
  tamanho?: "sm" | "md";
  className?: string;
}) {
  const Icone = ATIVIDADE_ICONE[tipo];
  return (
    <span
      role="img"
      aria-label={ATIVIDADE_ROTULO[tipo]}
      title={ATIVIDADE_ROTULO[tipo]}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        tamanho === "md" ? "h-8 w-8" : "h-6 w-6",
        TOM[tipo], className,
      )}
    >
      <Icone aria-hidden="true" className={tamanho === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
    </span>
  );
}
