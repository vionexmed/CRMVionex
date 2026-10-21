import { Children, isValidElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type AbaDePagina<T extends string> = {
  valor: T;
  rotulo: string;
  icone?: LucideIcon;
  rotuloCurto?: string;
};

/** A rolagem fica na barra; todas as abas preservam nome e teclado do Radix. */
export function PageTabs<T extends string>({ abas, className }: { abas: AbaDePagina<T>[]; className?: string }) {
  return (
    <TabsList className={cn("flex h-auto w-full overflow-x-auto", className)}>
      {abas.map(({ valor, rotulo, rotuloCurto, icone: Icone }) => (
        <TabsTrigger key={valor} value={valor} aria-label={rotulo} className="px-2 text-sm">
          {Icone && <Icone aria-hidden="true" className="h-4 w-4 shrink-0" />}
          {rotuloCurto ? <><span className="hidden sm:inline">{rotulo}</span><span className="sm:hidden">{rotuloCurto}</span></> : rotulo}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

export function contarAbas(children: ReactNode): number {
  return Children.toArray(children).filter(isValidElement).length;
}
