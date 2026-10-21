import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lerPreco, mapearColunasDeProduto, planejarProdutos } from "@/lib/importar-produtos";
import {
  categoriasDoCatalogo, resumoDeVendas, tipoDoProduto, unidadeDoPreco,
} from "@/lib/produtos-catalogo";

describe("lerPreco", () => {
  it.each([
    ["R$ 1.200,50", 1200.5], ["1200.50", 1200.5], ["1.200", 1200], ["490", 490], ["12,5", 12.5], ["1,200.75", 1200.75],
  ])("%s -> %s", (bruto, esperado) => expect(lerPreco(bruto)).toBe(esperado));
  it("ilegível vira null, não zero", () => {
    expect(lerPreco("abc")).toBeNull();
    expect(lerPreco("")).toBeNull();
  });
});

describe("importação de produtos", () => {
  const cab = ["Produto", "Descrição", "Valor", "Categoria"];
  it("reconhece cabeçalhos com acento e sinônimos", () => {
    expect(mapearColunasDeProduto(cab)).toEqual(["nome", "descricao", "preco", "categoria"]);
  });
  it("separa novo, existente, repetido e inválido", () => {
    const plano = planejarProdutos(
      [["Plano A", "", "100", "Planos"], ["plano a", "", "100", ""], ["Já Tem", "", "5", ""], ["", "", "1", ""], ["X", "", "zz", ""]],
      mapearColunasDeProduto(cab),
      [{ nome: "Já tem" }],
    );
    expect(plano.map((l) => l.situacao)).toEqual(["novo", "repetido", "existe", "invalido", "invalido"]);
  });
});

describe("catálogo", () => {
  it("tipo cai na unidade quando não classificado", () => {
    expect(tipoDoProduto({ unidade: "mês por unidade" })).toBe("recorrente");
    expect(tipoDoProduto({ unidade: "único" })).toBe("unico");
    expect(tipoDoProduto({ unidade: "mês", tipo_cobranca: "adicional" })).toBe("adicional");
  });
  it("abas na ordem de cadastro, sem duplicar por acento", () => {
    const abas = categoriasDoCatalogo([
      { created_at: "2", categoria: "Implantação" }, { created_at: "1", categoria: "Planos" }, { created_at: "3", categoria: "implantacao" },
    ]);
    expect(abas.map((a) => a.rotulo)).toEqual(["Planos", "Implantação"]);
  });
  it("resumo de vendas por tipo", () => {
    expect(resumoDeVendas({}, "recorrente", { clientes: 21, vendas_mes: 3 }, "out")).toBe("21 clientes · 3 vendas em out");
    expect(resumoDeVendas({ rotulo_clientes: "redes" }, "recorrente", { clientes: 6, vendas_mes: 1 }, "out")).toBe("6 redes · 1 venda em out");
    expect(resumoDeVendas({}, "unico", { clientes: 5, vendas_mes: 5 }, "out")).toBe("5 vendas em out");
    expect(unidadeDoPreco("único")).toBe("único");
    expect(unidadeDoPreco("mês")).toBe("/mês");
  });
});

describe("migrações de produtos", () => {
  const sql = readFileSync("supabase/migrations/20261021140100_produtos_metricas.sql", "utf8");
  it("conta só orçamento aprovado e negócio ganho, e checa a organização", () => {
    expect(sql).toContain("o.status = 'aprovado'");
    expect(sql).toContain("d.status IN ('won')");
    expect(sql).toContain("user_belongs_to_org");
  });
});
