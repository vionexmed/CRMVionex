import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // `rounded-full` + `px-2.5` + `font-semibold` fazia cada selo virar uma
  // pílula gorda. Numa linha de tabela com quatro colunas de dado, três selos
  // assim dominam a linha e o dado vira secundário.
  //
  // Raio do token (o mesmo de tudo), menos preenchimento lateral, e peso médio
  // em vez de semibold: o selo passa a ser uma marca, não um botão.
  "inline-flex items-center rounded-md border px-2 py-0.5 text-label font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
