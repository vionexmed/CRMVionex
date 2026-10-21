import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** O control fornece seu próprio label/aria-label; label pode ser um <label htmlFor>. */
export function SettingsRow({ label, description, control, className }: {
  label: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-3 border-b border-border py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:items-center sm:gap-6", className)}>
      <div className="min-w-0"><div className="text-sm font-medium">{label}</div>{description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}</div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}
