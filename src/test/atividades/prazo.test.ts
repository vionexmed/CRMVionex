import { describe, it, expect } from "vitest";
import { diasDeAtraso, textoDeAtraso } from "@/components/atividades/prazo";

const agora = new Date(2026, 9, 21, 9, 0);

describe("atraso em dias de calendário", () => {
  it("vencida ontem à noite é 1 dia, não zero", () => {
    expect(diasDeAtraso(new Date(2026, 9, 20, 18, 0), agora)).toBe(1);
    expect(textoDeAtraso(new Date(2026, 9, 20, 18, 0), agora)).toBe("atrasada 1 dia");
  });
  it("vencida hoje mais cedo diz 'atrasada hoje'", () => {
    expect(textoDeAtraso(new Date(2026, 9, 21, 8, 0), agora)).toBe("atrasada hoje");
  });
  it("plural e prazo futuro", () => {
    expect(textoDeAtraso(new Date(2026, 9, 14, 12, 0), agora)).toBe("atrasada 7 dias");
    expect(diasDeAtraso(new Date(2026, 9, 25), agora)).toBe(0);
  });
});
