// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import {
  AbasSegmentadas,
  BarraDeFerramentas,
  CartaoDeGrafico,
  CelulaDeNome,
  SeletorDePeriodo,
  SeletorTracejado,
  TabelaDeCartoes,
  corPastel,
  textoDeNegocios,
  type Periodo,
} from "@/components/padrao";

function Caso() {
  const [v, setV] = useState("a");
  return (
    <AbasSegmentadas
      rotulo="Visão"
      valor={v}
      onChange={setV}
      abas={[
        { valor: "a", rotulo: "Negócios" },
        { valor: "b", rotulo: "Atividades" },
      ]}
    />
  );
}

describe("BarraDeFerramentas", () => {
  it("concorda singular e plural no contador", () => {
    const { rerender } = render(<BarraDeFerramentas contador={1} />);
    expect(screen.getByText("1 resultado")).toBeInTheDocument();
    rerender(<BarraDeFerramentas contador={0} />);
    expect(screen.getByText("0 resultados")).toBeInTheDocument();
    rerender(<BarraDeFerramentas contador={12} />);
    expect(screen.getByText("12 resultados")).toBeInTheDocument();
  });

  it("busca é controlada", () => {
    const onChange = vi.fn();
    render(<BarraDeFerramentas busca={{ valor: "", onChange }} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Pesquisar" }), { target: { value: "ana" } });
    expect(onChange).toHaveBeenCalledWith("ana");
  });
});

describe("SeletorTracejado", () => {
  it("abre o menu e troca o valor", () => {
    const onChange = vi.fn();
    render(
      <SeletorTracejado
        rotulo="Visões"
        valor="todas"
        onChange={onChange}
        opcoes={[
          { valor: "todas", rotulo: "Todas" },
          { valor: "minhas", rotulo: "Minhas" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Visões/ }));
    expect(screen.getByRole("option", { name: "Todas" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("option", { name: "Minhas" }));
    expect(onChange).toHaveBeenCalledWith("minhas");
  });
});

describe("AbasSegmentadas", () => {
  it("marca a ativa e navega por setas", () => {
    render(<Caso />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const [a, b] = screen.getAllByRole("tab");
    expect(a).toHaveAttribute("aria-selected", "true");
    expect(b).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(b).toHaveAttribute("aria-selected", "true");
    expect(b).toHaveFocus();
    fireEvent.keyDown(b, { key: "ArrowRight" });
    expect(a).toHaveAttribute("aria-selected", "true");
  });
});

describe("TabelaDeCartoes", () => {
  it("rola dentro do contêiner e a linha é selecionável", () => {
    const onClick = vi.fn();
    const onSel = vi.fn();
    const { container } = render(
      <TabelaDeCartoes colunas="2fr 1fr" comCheckbox larguraMinima={700}>
        <TabelaDeCartoes.Cabecalho rotulos={["Nome", "Tipo"]} />
        <TabelaDeCartoes.Linha onClick={onClick} onSelecionadaChange={onSel}>
          <span>Ana</span>
          <span>Pessoa</span>
        </TabelaDeCartoes.Linha>
      </TabelaDeCartoes>,
    );
    const raiz = container.querySelector("[data-tabela-de-cartoes]") as HTMLElement;
    expect(raiz.className).toContain("overflow-x-auto");
    expect(screen.getByRole("table")).toHaveStyle({ minWidth: "700px" });

    const linhas = screen.getAllByRole("row");
    expect(linhas[1]).toHaveStyle({ gridTemplateColumns: "2.5rem 2fr 1fr" });
    fireEvent.click(screen.getByText("Ana"));
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar linha" }));
    expect(onSel).toHaveBeenCalledWith(true);
    expect(onClick).toHaveBeenCalledTimes(1); // checkbox não aciona a linha
  });

  it("marca a linha selecionada", () => {
    render(
      <TabelaDeCartoes colunas="1fr">
        <TabelaDeCartoes.Linha selecionada onClick={() => {}}>
          <span>x</span>
        </TabelaDeCartoes.Linha>
      </TabelaDeCartoes>,
    );
    expect(screen.getByRole("row")).toHaveAttribute("aria-selected", "true");
  });
});

describe("SeletorDePeriodo", () => {
  const valor: Periodo = { de: new Date(2026, 9, 15), ate: new Date(2026, 9, 22) };

  it("mostra o intervalo em pt-BR", () => {
    render(<SeletorDePeriodo valor={valor} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Período" })).toHaveTextContent("out 15, 2026 - out 22, 2026");
  });

  it("atalhos calculam o intervalo a partir de hoje", () => {
    const onChange = vi.fn();
    render(<SeletorDePeriodo valor={valor} onChange={onChange} hoje={new Date(2026, 9, 22)} />);
    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    const p = onChange.mock.calls[0][0] as Periodo;
    expect(p.de).toEqual(new Date(2026, 8, 1));
    expect(p.ate).toEqual(new Date(2026, 8, 30));

    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    expect((onChange.mock.calls[1][0] as Periodo).de).toEqual(new Date(2026, 9, 15));
  });
});

describe("CartaoDeGrafico", () => {
  it("vazio mostra 'Não há dados' e esconde o corpo", () => {
    render(
      <CartaoDeGrafico titulo="Dados diários" vazio>
        <div>grafico</div>
      </CartaoDeGrafico>,
    );
    expect(screen.getByText("Não há dados")).toBeInTheDocument();
    expect(screen.queryByText("grafico")).toBeNull();
  });

  it("com dados mostra o corpo", () => {
    render(
      <CartaoDeGrafico titulo="T">
        <div>grafico</div>
      </CartaoDeGrafico>,
    );
    expect(screen.getByText("grafico")).toBeInTheDocument();
    expect(screen.queryByText("Não há dados")).toBeNull();
  });
});

describe("CelulaDeNome", () => {
  it("cor é estável por nome (e ignora caixa/espaços)", () => {
    expect(corPastel("Ana Prado")).toEqual(corPastel("  ana prado "));
    const cores = new Set(["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gil"].map((n) => corPastel(n).fundo));
    expect(cores.size).toBeGreaterThan(2);
  });

  it("renderiza inicial e o mesmo estilo em duas montagens", () => {
    const a = render(<CelulaDeNome nome="Referência" apoio="Ticket médio" />);
    const el1 = a.container.querySelector("[data-avatar]") as HTMLElement;
    expect(el1).toHaveTextContent("R");
    const bg = el1.style.backgroundColor;
    a.unmount();
    const b = render(<CelulaDeNome nome="Referência" />);
    expect((b.container.querySelector("[data-avatar]") as HTMLElement).style.backgroundColor).toBe(bg);
  });
});

describe("ColunaKanban", () => {
  it("texto de negócios", () => {
    expect(textoDeNegocios(0)).toBe("Nenhum negócio");
    expect(textoDeNegocios(1)).toBe("1 negócio");
    expect(textoDeNegocios(3)).toBe("3 negócios");
  });
});
