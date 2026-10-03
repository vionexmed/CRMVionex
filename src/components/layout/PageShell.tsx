import type { ReactNode } from "react";
import { Contagem, PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

/** O AppLayout fornece o padding da página; a casca organiza seu conteúdo. */
export function PageShell({ kicker, title, description, contagem, actions, meta, toolbar,
  preencherAltura = false, children, className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  contagem?: Contagem;
  actions?: ReactNode;
  meta?: ReactNode;
  toolbar?: ReactNode;
  preencherAltura?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-6", preencherAltura && "flex h-full min-h-0 flex-col space-y-0 gap-6", className)}>
      <PageHeader kicker={kicker} title={title} description={description} contagem={contagem} actions={actions} meta={meta} />
      {toolbar}
      {preencherAltura ? <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div> : children}
    </div>
  );
}
