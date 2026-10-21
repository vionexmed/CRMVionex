import { useMemo } from "react";
import { FaixaDeIndicadores, Indicador } from "@/components/layout/ListaV1";
import { CartaoDeRelatorio, GradeDeRelatorio, VazioDoBloco } from "@/components/reports/CartaoDeRelatorio";
import { Button } from "@/components/ui/button";
import { AreaSeries } from "@/components/dashboard/svg/AreaSeries";
import { RoscaComLegenda } from "@/components/dashboard/svg/RoscaComLegenda";
import { BarrasAgrupadas } from "@/components/dashboard/svg/BarrasAgrupadas";
import { formatarNumero } from "@/lib/formato";
import { Download } from "lucide-react";
import { LIFECYCLE_LABELS, type LifecycleStage } from "@/lib/contact-options";
import {
  Contact, Profile,
  pct, CHART_COLORS, MONTHS_PT,
  downloadCSV,
} from "@/components/reports/types";

export function ContactsReport({ contacts, members }: { contacts: Contact[]; members: Profile[] }) {
  // Monthly growth (last 12 months)
  const monthlyGrowth = useMemo(() => {
    const now = new Date();
    const data: { month: string; novos: number; total: number }[] = [];
    let cumulative = 0;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const newInMonth = contacts.filter((c) => {
        if (!c.created_at) return false;
        const cd = new Date(c.created_at);
        return cd >= d && cd < nextMonth;
      }).length;
      cumulative += newInMonth;
      data.push({ month: MONTHS_PT[d.getMonth()], novos: newInMonth, total: cumulative });
    }
    return data;
  }, [contacts]);

  /**
   * Por estágio do CICLO DE VIDA, não pela coluna legada `status`.
   *
   * `status` tem 4 valores e `lifecycle_stage` tem 6, e o gatilho que
   * sincroniza as duas mapeia COM PERDA: `contacted` colapsa em `lead`, e
   * `opportunity` colapsa em `prospect`. Este gráfico mostrava quatro fatias
   * onde a tela de Contatos mostra seis -- "Contatado" e "Em negociação"
   * simplesmente não existiam aqui.
   *
   * Os rótulos também eram três em inglês ("Lead", "Prospect", "Churned") numa
   * interface em português.
   */
  const byStatus = useMemo(() => {
    const map = new Map<LifecycleStage, number>();
    for (const c of contacts) {
      const estagio = (c.lifecycle_stage || "lead") as LifecycleStage;
      map.set(estagio, (map.get(estagio) || 0) + 1);
    }
    // Ordem do avanço, não ordem de aparição: a fatia maior mudava de cor
    // conforme o dado, porque a cor vem do índice.
    return (Object.keys(LIFECYCLE_LABELS) as LifecycleStage[])
      .filter((e) => map.has(e))
      .map((e) => ({ name: LIFECYCLE_LABELS[e], value: map.get(e)! }));
  }, [contacts]);

  const totalCustomers = contacts.filter((c) => c.lifecycle_stage === "customer").length;

  /**
   * Conversão lead → cliente.
   *
   * O denominador era `lead + prospect + customer`, ou seja, TODOS menos os
   * descartados -- e descartado é justamente quem entrou e não converteu.
   * Tirá-lo da conta inflava a taxa: dez contatos, um cliente e cinco
   * descartados davam 20% em vez de 10%.
   *
   * Todo contato entra como lead, então o denominador honesto é o total.
   */
  const conversionRate = pct(totalCustomers, contacts.length);

  // By owner
  const byOwner = useMemo(() =>
    members.map((m) => ({
      name: m.name || m.email || "—",
      count: contacts.filter((c) => c.owner_id === m.id).length,
    })).filter((m) => m.count > 0).sort((a, b) => b.count - a.count),
    [members, contacts]
  );

  const exportCSV = () => {
    downloadCSV(contacts.map((c) => ({
      Nome: `${c.first_name} ${c.last_name || ""}`.trim(),
      "Ciclo de vida": LIFECYCLE_LABELS[(c.lifecycle_stage || "lead") as LifecycleStage], Score: c.lead_score,
      Dono: members.find((m) => m.id === c.owner_id)?.name || "",
      Criado: c.created_at,
    })), "relatorio-contatos");
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Esta aba não segue o período: crescimento mensal já é uma linha do
          tempo, e a distribuição é a foto da base hoje. Dizer isso evita ler
          "Total de contatos" como "contatos criados neste mês". */}
      <FaixaDeIndicadores>
        <Indicador rotulo="Total de contatos" valor={formatarNumero(contacts.length)} apoio="toda a base" />
        <Indicador rotulo="Clientes" valor={formatarNumero(totalCustomers)} apoio="no ciclo de vida" tom={totalCustomers > 0 ? "sucesso" : undefined} />
        <Indicador rotulo="Lead → cliente" valor={`${conversionRate}%`} apoio="clientes sobre o total" />
      </FaixaDeIndicadores>

      <GradeDeRelatorio>
        <CartaoDeRelatorio
          titulo="Crescimento mensal"
          descricao="Últimos 12 meses"
          acoes={<Button variant="outline" size="sm" onClick={exportCSV}><Download aria-hidden />Exportar CSV</Button>}
        >
          {/* A série "Novos" NUNCA foi desenhada.
              Era um `<Bar>` dentro de um `<AreaChart>`, e o recharts descarta
              filhos que o tipo do gráfico não conhece -- só `ComposedChart`
              aceita barra e área juntas. A legenda mostrava "Novos" e a linha
              não existia. Agora as duas séries aparecem. */}
          <AreaSeries
            formatar={formatarNumero}
            rotulos={monthlyGrowth.map((m) => m.month)}
            series={[
              { nome: "Cumulativo", cor: CHART_COLORS[0], pontos: monthlyGrowth.map((m) => m.total), preencher: true },
              { nome: "Novos no mês", cor: CHART_COLORS[1], pontos: monthlyGrowth.map((m) => m.novos) },
            ]}
          />
        </CartaoDeRelatorio>

        <CartaoDeRelatorio titulo="Distribuição por ciclo de vida">
          {byStatus.length > 0 ? (
            <RoscaComLegenda
              formatar={formatarNumero}
              tamanho={140}
              fatias={byStatus.map((b, i) => ({
                nome: b.name,
                valor: b.value,
                cor: CHART_COLORS[i % CHART_COLORS.length],
              }))}
            />
          ) : (
            <VazioDoBloco>Nenhum contato cadastrado.</VazioDoBloco>
          )}
        </CartaoDeRelatorio>
      </GradeDeRelatorio>

      {byOwner.length > 0 && (
        <CartaoDeRelatorio titulo="Contatos por responsável">
          <BarrasAgrupadas
            linhas={byOwner}
            rotulo={(o) => o.name}
            formatar={formatarNumero}
            vazio="Nenhum contato com responsável definido"
            series={[{ nome: "Contatos", cor: CHART_COLORS[0], valor: (o) => o.count }]}
          />
        </CartaoDeRelatorio>
      )}
    </div>
  );
}
