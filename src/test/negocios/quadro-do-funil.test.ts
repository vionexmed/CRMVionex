/**
 * O quadro de Negócios no Visual 01: os sinais do card e da faixa de
 * indicadores (função pura, relógio fixo) e as proteções do arraste, que
 * quebram em silêncio e não aparecem em captura de tela.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  corDaEtapa, diasParado, filtrarPorSinal, proximaAtividade, resumirFunil, rotuloDaProxima,
} from "@/components/negocios/sinais";
import type { AtividadeDoNegocio, DealWithRelations } from "@/lib/api/deals";
import type { Database } from "@/integrations/supabase/types";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");

// Quarta, 21 out 2026, 12:00 local.
const AGORA = new Date(2026, 9, 21, 12, 0).getTime();
const iso = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

const atividade = (p: Partial<AtividadeDoNegocio>): AtividadeDoNegocio => ({
  id: Math.random().toString(36), type: "call", title: null, body: null,
  due_date: null, completed_at: null, created_at: iso(2026, 9, 1), ...p,
});

const negocio = (p: Partial<DealWithRelations>): DealWithRelations => ({
  id: Math.random().toString(36), org_id: "o", title: "N", value: 0, currency: "BRL",
  stage_id: "e1", status: "open", probability: 0, close_date: null, company_id: null,
  contact_id: null, owner_id: null, loss_reason: null, loss_reason_id: null, qualification: null,
  qualification_score: null, created_at: iso(2026, 9, 20), updated_at: null,
  etapa_desde: iso(2026, 9, 20), temperatura: null,
  atividades: [], ...p,
});

type Etapa = Database["public"]["Tables"]["pipeline_stages"]["Row"];
const etapa = (id: string, order: number, win_probability: number | null): Etapa => ({
  id, order, win_probability, name: id, color: null, created_at: null, org_id: "o", pipeline_id: "f",
});

describe("cor da etapa pela posição", () => {
  it("a primeira é a marca e a última é o verde, qualquer que seja o tamanho", () => {
    for (const total of [2, 4, 6, 9]) {
      expect(corDaEtapa(0, total)).toBe("bg-stage-1");
      expect(corDaEtapa(total - 1, total)).toBe("bg-stage-6");
    }
    expect(corDaEtapa(0, 1)).toBe("bg-stage-1");
  });
});

describe("próxima atividade", () => {
  it("pega a pendente de prazo mais antigo e ignora concluída e sem prazo", () => {
    const atrasada = atividade({ type: "meeting", due_date: iso(2026, 9, 19, 15) });
    const p = proximaAtividade([
      atividade({ due_date: iso(2026, 9, 23, 9) }),
      atrasada,
      atividade({ due_date: iso(2026, 9, 1), completed_at: iso(2026, 9, 1) }),
      atividade({ due_date: null }),
    ], AGORA);
    expect(p?.atividade).toBe(atrasada);
    expect(p?.atrasada).toBe(true);
    expect(p?.diasDeAtraso).toBe(2);
    expect(rotuloDaProxima(p!, AGORA)).toBe("Reunião atrasada 2 dias");
  });

  it("sem pendente com prazo não há próxima", () => {
    expect(proximaAtividade([atividade({ completed_at: iso(2026, 9, 2) })], AGORA)).toBeNull();
    expect(proximaAtividade(null, AGORA)).toBeNull();
  });

  it("futura lê o dia da semana e a hora", () => {
    const p = proximaAtividade([atividade({ due_date: iso(2026, 9, 26, 9) })], AGORA)!;
    expect(p.atrasada).toBe(false);
    expect(rotuloDaProxima(p, AGORA)).toMatch(/^Ligação seg/);
  });
});

describe("parado", () => {
  it("conta do último movimento: atividade feita ou criação do negócio", () => {
    expect(diasParado(negocio({ created_at: iso(2026, 9, 1), atividades: [] }), AGORA)).toBe(20);
    expect(diasParado(negocio({
      created_at: iso(2026, 9, 1),
      atividades: [atividade({ completed_at: iso(2026, 9, 18) })],
    }), AGORA)).toBe(3);
  });

  it("os chips de sinal filtram pelos mesmos critérios do card", () => {
    const atrasado = negocio({ atividades: [atividade({ due_date: iso(2026, 9, 20) })] });
    const parado = negocio({ created_at: iso(2026, 9, 1) });
    const ok = negocio({});
    const todos = [atrasado, parado, ok];
    expect(filtrarPorSinal(todos, { atrasada: false, paradosHa: null }, AGORA)).toEqual(todos);
    expect(filtrarPorSinal(todos, { atrasada: true, paradosHa: null }, AGORA)).toEqual([atrasado]);
    expect(filtrarPorSinal(todos, { atrasada: false, paradosHa: 7 }, AGORA)).toEqual([parado]);
  });
});

describe("faixa de indicadores", () => {
  const etapas = [etapa("e2", 1, 60), etapa("e1", 0, 10)];

  it("soma o aberto por etapa, na ordem do funil", () => {
    const r = resumirFunil({
      abertos: [negocio({ value: 100, stage_id: "e1" }), negocio({ value: 300, stage_id: "e2" })],
      ganhos: [], perdidos: [], etapas, agora: AGORA,
    });
    expect(r.aberto.total).toBe(400);
    expect(r.aberto.quantidade).toBe(2);
    expect(r.aberto.porEtapa.map((e) => [e.id, e.total])).toEqual([["e1", 100], ["e2", 300]]);
    expect(r.ponderada).toBeCloseTo(100 * 0.1 + 300 * 0.6);
  });

  it("sem probabilidade em etapa nenhuma, a previsão ponderada some", () => {
    const r = resumirFunil({
      abertos: [negocio({ value: 100 })], ganhos: [], perdidos: [],
      etapas: [etapa("e1", 0, null), etapa("e2", 1, 0)], agora: AGORA,
    });
    expect(r.ponderada).toBeNull();
  });

  it("ganhos do mês: status ganho E fechamento no mês corrente", () => {
    const r = resumirFunil({
      abertos: [],
      ganhos: [
        negocio({ status: "won", value: 50, close_date: "2026-10-03" }),
        negocio({ status: "won", value: 70, close_date: "2026-09-30" }),
        negocio({ status: "won", value: 90, close_date: null }),
      ],
      perdidos: [negocio({ status: "lost" })],
      etapas, agora: AGORA,
    });
    expect(r.ganhosNoMes).toEqual({ total: 50, quantidade: 1 });
    expect(r.taxa).toEqual({ ganhos: 3, encerrados: 4, percentual: 75 });
  });

  it("sem encerrados, a taxa não vira 0%", () => {
    expect(resumirFunil({ abertos: [], ganhos: [], perdidos: [], etapas, agora: AGORA }).taxa).toBeNull();
  });
});

describe("o arraste do quadro de negócios", () => {
  const kanban = semComentarios(readFileSync("src/components/crm/DealsKanban.tsx", "utf8"));

  it("o DragOverlay vai por portal para o body", () => {
    expect(kanban).toMatch(/createPortal\(\s*<DragOverlay>[\s\S]*?<\/DragOverlay>,\s*document\.body,?\s*\)/);
  });

  it("nenhuma classe de transform, escala, filtro ou backdrop", () => {
    const literais = [...kanban.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]);
    const proibidas = literais
      .flatMap((l) => l.split(/\s+/))
      .map((t) => t.replace(/^([a-z-]+:)+/, ""))
      .filter((t) => /^(-?scale-|-?rotate-|-?translate-|transform$|filter$|blur|backdrop-|drop-shadow)/.test(t));
    expect(proibidas).toEqual([]);
  });

  it("o card espalha attributes e listeners ANTES do onPointerDown próprio, e o chama", () => {
    const card = kanban.slice(kanban.indexOf("const DealCard = memo"));
    const a = card.indexOf("{...attributes}");
    const l = card.indexOf("{...listeners}");
    const p = card.indexOf("onPointerDown={(e) => {");
    expect(a).toBeGreaterThan(-1);
    expect(l).toBeGreaterThan(a);
    expect(p).toBeGreaterThan(l);
    expect(card.slice(p, p + 200)).toContain("listeners?.onPointerDown?.(e)");
  });

  it("ganho e perda são comparados pelos mesmos ids das zonas", () => {
    for (const id of ["won-drop", "lost-drop"]) {
      expect(kanban).toContain(`id="${id}"`);
      expect(kanban).toContain(`overId === "${id}"`);
    }
  });
});

describe("a página de Negócios", () => {
  const deals = semComentarios(readFileSync("src/pages/Deals.tsx", "utf8"));

  it("a lista paginada recebe os filtros campo a campo", () => {
    for (const campo of ["ownerId", "minValue", "maxValue", "closeDateFrom", "closeDateTo"]) {
      expect(deals).toContain(`${campo}: filters.${campo}`);
    }
    expect(deals).not.toMatch(/\.\.\.filters\b/);
  });

  it("o painel é irmão do quadro, não ancestral", () => {
    const i = deals.indexOf("<DealsKanban");
    const fim = deals.indexOf("/>", i);
    const painel = deals.indexOf("<PainelDoNegocio");
    expect(painel).toBeGreaterThan(fim);
  });
});
