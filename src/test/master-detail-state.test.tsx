// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { MasterDetailLayout } from "@/components/layout/MasterDetailLayout";

afterEach(cleanup);

function Layout() {
  const [selected, setSelected] = useState(true);
  return <MasterDetailLayout
    selected={selected}
    onBack={() => setSelected(false)}
    master={<button onClick={() => setSelected(true)}>Abrir registro</button>}
    detail={<input aria-label="Rascunho da conversa" defaultValue="" />}
    context={<input aria-label="Nota do contato" defaultValue="" />}
  />;
}

it("preserva rascunhos do detalhe e contexto ao voltar e reabrir o registro", () => {
  render(<Layout />);
  fireEvent.change(screen.getByLabelText("Rascunho da conversa"), { target: { value: "Mensagem em edição" } });
  fireEvent.change(screen.getByLabelText("Nota do contato"), { target: { value: "Confirmar orçamento" } });
  fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
  fireEvent.click(screen.getByRole("button", { name: "Abrir registro" }));
  expect(screen.getByLabelText("Rascunho da conversa")).toHaveValue("Mensagem em edição");
  expect(screen.getByLabelText("Nota do contato")).toHaveValue("Confirmar orçamento");
});
