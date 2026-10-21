import { cn } from "@/lib/utils";
import { formatarNumero } from "@/lib/formato";

/**
 * Abas por categoria com a contagem num selo arredondado (azul na aba ativa).
 * `ListaV1.VisoesDaLista` mostra a contagem como número solto; a referência de
 * Produtos usa selo, e mudar o componente compartilhado alteraria as outras telas.
 */
export function AbasDeCategoria({
  abas, valor, onChange,
}: {
  abas: { chave: string; rotulo: string; contagem: number }[];
  valor: string;
  onChange: (chave: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card px-2">
      <div role="tablist" aria-label="Categorias de produto" className="flex min-w-max items-end gap-1">
        {abas.map((a) => {
          const ativa = a.chave === valor;
          return (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => onChange(a.chave)}
              className={cn(
                "vx-control flex min-h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                ativa ? "border-primary font-semibold text-foreground" : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {a.rotulo}
              <span className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-label font-semibold tabular-nums",
                ativa ? "bg-accent text-primary" : "bg-neutral-soft text-muted-foreground",
              )}>
                {formatarNumero(a.contagem)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
