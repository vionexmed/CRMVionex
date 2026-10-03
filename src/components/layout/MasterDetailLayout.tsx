import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Mantém lista, detalhe e contexto montados para preservar rascunhos ao alternar. */
export function MasterDetailLayout({ master, detail, selected, onBack, context, className }: {
  master: ReactNode;
  detail: ReactNode;
  selected: boolean;
  onBack: () => void;
  context?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className={cn("min-h-0 min-w-0 w-full flex-col overflow-y-auto lg:w-80 lg:shrink-0 lg:border-r lg:border-border", selected ? "hidden lg:flex" : "flex")}>
        {master}
      </div>
      <div className={cn("min-h-0 min-w-0 flex-1 flex-col", selected ? "flex" : "hidden lg:flex")}>
        {selected && <div className="shrink-0 border-b border-border p-2 lg:hidden"><Button variant="ghost" onClick={onBack}><ArrowLeft aria-hidden="true" />Voltar à lista</Button></div>}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto xl:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{detail}</div>
          {context && <aside hidden={!selected} aria-label="Contexto do registro" className="shrink-0 border-t border-border xl:w-80 xl:overflow-y-auto xl:border-l xl:border-t-0">{context}</aside>}
        </div>
      </div>
    </div>
  );
}
