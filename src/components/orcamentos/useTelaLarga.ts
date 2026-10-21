import { useEffect, useState } from "react";

/**
 * `true` a partir do breakpoint `xl` do Tailwind (1280px).
 *
 * Existe porque a prévia ao lado da lista e a gaveta são DUAS apresentações do
 * mesmo orçamento: renderizar as duas e esconder uma por CSS montaria dois
 * compositores de e-mail e duas consultas de negócios. Aqui só uma existe.
 * Sem `matchMedia` (teste, SSR) cai em `false`, que é o comportamento antigo.
 */
export function useTelaLarga(): boolean {
  const consulta = "(min-width: 1280px)";
  const [larga, setLarga] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(consulta).matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(consulta);
    const aoMudar = () => setLarga(mql.matches);
    aoMudar();
    mql.addEventListener("change", aoMudar);
    return () => mql.removeEventListener("change", aoMudar);
  }, []);
  return larga;
}
