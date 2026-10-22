import { readFileSync } from "node:fs";

/** A tela do painel mora em vários arquivos; os testes de varredura leem todos. */
export const ARQUIVOS_DO_PAINEL = [
  "src/pages/Dashboard.tsx",
  "src/components/dashboard/VisaoComercial.tsx",
  "src/components/dashboard/VisoesDeAtendimentoEAtividades.tsx",
  "src/components/dashboard/dados-do-painel.tsx",
  "src/components/dashboard/indicadores.ts",
];

export const fontesDoPainel = () => ARQUIVOS_DO_PAINEL.map((f) => readFileSync(f, "utf8")).join("\n");
