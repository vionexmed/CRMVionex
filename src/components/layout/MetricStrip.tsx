import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const desktopColumns = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" };

/** Indicadores em duas colunas no celular e colunas configuráveis no desktop. */
export function MetricStrip({ children, columns = 4, className }: {
  children: ReactNode;
  columns?: keyof typeof desktopColumns;
  className?: string;
}) {
  return (
    <div className={cn("vx-metrics-strip grid grid-cols-2", desktopColumns[columns], className)}>
      {Children.toArray(children).map((child, index) => <div key={index} className="min-w-0 border-r border-b border-border last:border-r-0">{child}</div>)}
    </div>
  );
}
