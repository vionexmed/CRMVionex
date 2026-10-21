import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Uma superfície contínua. Cabeçalho, ferramentas e dados definem suas divisórias. */
export function WorkSurface({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 rounded-lg border border-border bg-card text-card-foreground", className)} {...props}>{children}</div>;
}
