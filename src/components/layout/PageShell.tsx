import type { ReactNode } from "react";
import { Contagem, PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

/** O AppLayout fornece o padding da página; a casca organiza seu conteúdo. */
export function PageShell({ kicker, title, description, contagem, actions, meta, toolbar,
  preencherAltura = false, surface = false, children, className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  contagem?: Contagem;
  actions?: ReactNode;
  meta?: ReactNode;
  toolbar?: ReactNode;
  preencherAltura?: boolean;
  surface?: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (surface) return (
    <div className={cn("-m-4 min-w-0 md:-m-7", className)}>
      <div className="px-4 pt-5 sm:px-6">
        <PageHeader kicker={kicker ?? ""} title={title} description={description} contagem={contagem} actions={actions} meta={meta} />
      </div>
      {toolbar}
      {children}
    </div>
  );
  return (
    <div className={cn("min-w-0 space-y-6", preencherAltura && "flex h-full min-h-0 flex-col space-y-0 gap-6", className)}>
      <PageHeader kicker={kicker ?? ""} title={title} description={description} contagem={contagem} actions={actions} meta={meta} />
      {toolbar}
      {preencherAltura ? <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div> : children}
    </div>
  );
}
