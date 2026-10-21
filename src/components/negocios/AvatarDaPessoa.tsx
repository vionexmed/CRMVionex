import { clsx } from "clsx";
import { iniciais } from "@/components/layout/ListaV1";
import { TONS_DE_PESSOA } from "@/components/negocios/sinais";

/**
 * Iniciais redondas no tom da pessoa (ver `tonsDaEquipe`).
 *
 * Não reaproveita `Iniciais` de ListaV1 passando a cor por `className`: o
 * `cn` (tailwind-merge) lê `text-label` como COR, e a cor do tom apagaria o
 * tamanho -- ou o contrário, conforme a ordem.
 */
export function AvatarDaPessoa({ nome, tom, tamanho = "sm", className }: {
  nome: string | null | undefined;
  /** Uma das classes de TONS_DE_PESSOA. Ausente: o primeiro tom. */
  tom?: string;
  tamanho?: "sm" | "md";
  className?: string;
}) {
  return (
    // `clsx`, e não `cn`: aqui as classes não disputam, só se somam.
    <span aria-hidden="true" className={clsx(
      "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
      tamanho === "sm" ? "h-6 w-6 text-label" : "h-[28px] w-[28px] text-label",
      tom ?? TONS_DE_PESSOA[0],
      className,
    )}>
      {iniciais(nome)}
    </span>
  );
}
