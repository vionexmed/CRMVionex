import { describe, expect, it } from "vitest";
import { numeroPorExtenso } from "@/lib/numero-por-extenso";
import { cnpjValido, formatarCnpj } from "@/lib/cnpj";

describe("numeroPorExtenso (BRL)", () => {
  const casos: [number, string][] = [
    [0, "Zero real"],
    [1, "Um real"],
    [21, "Vinte e um reais"],
    [100, "Cem reais"],
    [101, "Cento e um reais"],
    [1000, "Mil reais"],
    [1001, "Mil e um reais"],
    [1100, "Mil e cem reais"],
    [1234, "Mil duzentos e trinta e quatro reais"],
    [2000, "Dois mil reais"],
    [48000, "Quarenta e oito mil reais"],
    [12345.67, "Doze mil trezentos e quarenta e cinco reais e sessenta e sete centavos"],
    [1000000, "Um milhão de reais"],
    [2000000, "Dois milhões de reais"],
    [1500000, "Um milhão e quinhentos mil reais"],
    [0.01, "Um centavo"],
    [0.5, "Cinquenta centavos"],
    [1.01, "Um real e um centavo"],
    [2.02, "Dois reais e dois centavos"],
  ];
  it.each(casos)("%s", (v, esperado) => expect(numeroPorExtenso(v)).toBe(esperado));

  it("nunca diz 'um mil'", () => {
    expect(numeroPorExtenso(1000)).not.toMatch(/um mil/i);
    expect(numeroPorExtenso(21000)).toBe("Vinte e um mil reais");
  });
  it("arredonda centavos e ignora NaN", () => {
    expect(numeroPorExtenso(0.999)).toBe("Um real");
    expect(numeroPorExtenso(NaN)).toBe("Zero real");
  });
  it("outras moedas", () => {
    expect(numeroPorExtenso(2, "USD")).toBe("Dois dólares americanos");
    expect(numeroPorExtenso(1, "EUR")).toBe("Um euro");
    expect(numeroPorExtenso(5, "XYZ")).toBe("Cinco XYZ");
  });
});

describe("CNPJ", () => {
  it("valida pelos dígitos verificadores", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
  });
  it("máscara progressiva", () => {
    expect(formatarCnpj("11")).toBe("11");
    expect(formatarCnpj("11222")).toBe("11.222");
    expect(formatarCnpj("112223330001")).toBe("11.222.333/0001");
    expect(formatarCnpj("11222333000181999")).toBe("11.222.333/0001-81");
  });
});
