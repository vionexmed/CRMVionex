/**
 * O editor de etapas do funil.
 *
 * Havia dois, e **nenhum era completo**:
 *
 *   Negócios ("Personalizar funil")   renomear, recolorir, probabilidade
 *                                     — mas NÃO reordenar
 *   Configurações ("Etapas")          reordenar e apagar
 *                                     — mas NÃO renomear nem recolorir
 *
 * Em Configurações, corrigir o nome de uma etapa exigia apagá-la e criar de
 * novo — perdendo os negócios que estavam nela.
 *
 * E a descrição em Configurações prometia "Arraste para reordenar". Não havia
 * arraste nenhum: eram os caracteres ▲▼ como texto.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// Sem comentários: o próprio comentário que EXPLICA por que ▲▼ saíram contém
// os caracteres, e reprovaria a regra que ele documenta.
const LINHA = semComentarios(readFileSync("src/components/crm/LinhaDeEtapa.tsx", "utf8"));
const LINHA_BRUTA = readFileSync("src/components/crm/LinhaDeEtapa.tsx", "utf8");
const DEALS = semComentarios(readFileSync("src/pages/Deals.tsx", "utf8"));
const CONFIG = semComentarios(readFileSync("src/components/settings/PipelinesTab.tsx", "utf8"));

/*
 * Negócios deixou de ter editor próprio: a tela do funil do Visual 01 não tem
 * botão de engrenagem, e editar etapas mora em Configurações → Funis e etapas
 * (o "+ Funil" leva lá). A proteção continua a mesma -- UM editor completo, e
 * nenhuma segunda cópia que possa divergir dele.
 */
describe("um editor só, completo", () => {
  it("Configurações monta LinhaDeEtapa", () => {
    expect(CONFIG).toContain("<LinhaDeEtapa");
    expect(CONFIG).toContain('from "@/components/crm/LinhaDeEtapa"');
  });

  it("pode reordenar, renomear e recolorir", () => {
    // A ordem importa de verdade: a etapa de ENTRADA do funil é identificada
    // pelo MENOR `order`, nunca pelo nome.
    expect(CONFIG).toContain("onMover=");
    expect(CONFIG).toContain("onChange=");
  });

  it("Negócios não reabre um segundo editor à parte", () => {
    expect(DEALS).not.toContain('type="color"');
    expect(DEALS).not.toMatch(/win_probability:\s*Number/);
    // E a porta para o editor continua à vista para admin.
    expect(DEALS).toContain('"/settings?aba=pipelines"');
  });
});

describe("a linha faz as quatro coisas", () => {
  it("cor, nome, probabilidade e remover", () => {
    expect(LINHA).toContain('type="color"');
    expect(LINHA).toContain("onChange({ name:");
    expect(LINHA).toContain("win_probability:");
    expect(LINHA).toContain("onRemover");
  });

  /**
   * `min`/`max` do HTML não impedem digitar 500 -- só marcam o campo como
   * inválido. Uma etapa com 500% de probabilidade envenena a previsão inteira,
   * que soma por faixa.
   */
  it("limita a probabilidade na entrada, não só no atributo", () => {
    expect(LINHA).toMatch(/Math\.max\(0, Math\.min\(100,/);
  });

  /**
   * As setas eram os caracteres ▲▼ soltos: sem nome acessível, e com alvo de
   * clique do tamanho da letra.
   */
  it("as setas têm nome acessível", () => {
    expect(LINHA).not.toContain("▲");
    expect(LINHA).not.toContain("▼");
    expect(LINHA).toMatch(/aria-label=\{`Mover /);
  });

  it("todo campo tem rótulo", () => {
    // Nenhum dos dois editores rotulava os campos: era um `<input type=color>`
    // e um número solto, sem nome nenhum para leitor de tela.
    const rotulos = LINHA_BRUTA.match(/aria-label=/g) ?? [];
    expect(rotulos.length).toBeGreaterThanOrEqual(5);
  });
});

describe("Configurações não grava a cada tecla", () => {
  /**
   * A tela grava direto no banco, sem botão de salvar. Ligar `onChange` ao
   * `update` faria uma consulta por CARACTERE digitado no nome.
   */
  it("mantém rascunho e grava no blur", () => {
    expect(CONFIG).toMatch(/const \[rascunho, setRascunho\]/);
    expect(CONFIG).toContain("onSalvar=");
    expect(LINHA).toContain("onBlur={onSalvar}");
  });

  it("a descrição não promete arraste", () => {
    // Dizia "Arraste para reordenar" e não havia arraste nenhum.
    expect(CONFIG).not.toContain("Arraste para reordenar");
  });
});
