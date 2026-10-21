import { useMemo } from "react";
import { FaixaDeIndicadores, Indicador, Iniciais } from "@/components/layout/ListaV1";
import { CartaoDeRelatorio, GradeDeRelatorio, VazioDoBloco } from "@/components/reports/CartaoDeRelatorio";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RoscaComLegenda } from "@/components/dashboard/svg/RoscaComLegenda";
import { BarrasAgrupadas } from "@/components/dashboard/svg/BarrasAgrupadas";
import { formatarNumero } from "@/lib/formato";
import { Download } from "lucide-react";
import { ATIVIDADE_ROTULO, type ActivityType } from "@/lib/atividade-tipos";
import {
  ActivityRow, Profile,
  pct, CHART_COLORS,
  downloadCSV,
} from "@/components/reports/types";

export function ActivitiesReport({ activities, members }: { activities: ActivityRow[]; members: Profile[] }) {

  // By type donut
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    activities.forEach((a) => { map[a.type] = (map[a.type] || 0) + 1; });
    return Object.entries(map).map(([type, count]) => ({ name: ATIVIDADE_ROTULO[type as ActivityType] || type, value: count }));
  }, [activities]);

  type UserActivityRow = { name: string; total: number; call: number; email: number; meeting: number; note: number; task: number };
  // Per-user per-type table
  const userActivity = useMemo<UserActivityRow[]>(() => {
    return members.map((m) => {
      const ma = activities.filter((a) => a.user_id === m.id);
      return {
        name: m.name || m.email || "—", total: ma.length,
        call: ma.filter((a) => a.type === "call").length,
        email: ma.filter((a) => a.type === "email").length,
        meeting: ma.filter((a) => a.type === "meeting").length,
        note: ma.filter((a) => a.type === "note").length,
        task: ma.filter((a) => a.type === "task").length,
      };
    }).filter((m) => m.total > 0).sort((a, b) => b.total - a.total);
  }, [members, activities]);

  // Completion rate
  const completed = activities.filter((a) => a.completed_at).length;
  const completionRate = pct(completed, activities.length);

  const exportCSV = () => {
    downloadCSV(userActivity.map((u) => ({
      Responsável: u.name, Total: u.total,
      Ligações: u.call, "E-mails": u.email, Reuniões: u.meeting, Notas: u.note, Tarefas: u.task,
    })), "relatorio-atividades");
  };

  return (
    <div className="min-w-0 space-y-4">
      <FaixaDeIndicadores>
        <Indicador rotulo="Atividades no período" valor={formatarNumero(activities.length)} apoio="pela data de criação" />
        <Indicador rotulo="Concluídas" valor={formatarNumero(completed)} apoio="com conclusão registrada" tom={completed > 0 ? "sucesso" : undefined} />
        <Indicador rotulo="Taxa de conclusão" valor={`${completionRate}%`} apoio="concluídas sobre o total" />
      </FaixaDeIndicadores>

      <CartaoDeRelatorio
        titulo="Comparativo por responsável"
        rente
        acoes={<Button variant="outline" size="sm" onClick={exportCSV}><Download aria-hidden />Exportar CSV</Button>}
      >
        <div className="vx-table rounded-none border-x-0 border-b-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ligações</TableHead>
                <TableHead className="text-right">E-mails</TableHead>
                <TableHead className="text-right">Reuniões</TableHead>
                <TableHead className="text-right">Notas</TableHead>
                <TableHead className="text-right">Tarefas</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userActivity.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-xs text-muted-foreground">Nenhuma atividade registrada no período.</TableCell></TableRow>
              )}
              {userActivity.map((u) => (
                <TableRow key={u.name}>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-2 font-medium"><Iniciais nome={u.name} tamanho="sm" />{u.name}</span>
                  </TableCell>
                  <TableCell className="text-right text-xs">{u.call}</TableCell>
                  <TableCell className="text-right text-xs">{u.email}</TableCell>
                  <TableCell className="text-right text-xs">{u.meeting}</TableCell>
                  <TableCell className="text-right text-xs">{u.note}</TableCell>
                  <TableCell className="text-right text-xs">{u.task}</TableCell>
                  <TableCell className="text-right text-xs font-semibold">{u.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CartaoDeRelatorio>

      <GradeDeRelatorio>
        <CartaoDeRelatorio titulo="Atividades por responsável" descricao="Por tipo">
          {/* Barras horizontais em vez do gráfico vertical do recharts: o nome
              de cada pessoa era rótulo do eixo X, e com mais de quatro nomes o
              recharts os rotacionava ou cortava. */}
          <BarrasAgrupadas
            linhas={userActivity}
            rotulo={(u) => u.name}
            formatar={formatarNumero}
            vazio="Nenhuma atividade registrada por responsável"
            series={[
              { nome: "Ligação", cor: CHART_COLORS[0], valor: (u) => u.call },
              { nome: "E-mail", cor: CHART_COLORS[1], valor: (u) => u.email },
              { nome: "Reunião", cor: CHART_COLORS[2], valor: (u) => u.meeting },
              { nome: "Nota", cor: CHART_COLORS[3], valor: (u) => u.note },
              { nome: "Tarefa", cor: CHART_COLORS[4], valor: (u) => u.task },
            ]}
          />
        </CartaoDeRelatorio>

        <CartaoDeRelatorio titulo="Atividades por tipo">
          {byType.length > 0 ? (
            <RoscaComLegenda
              formatar={formatarNumero}
              tamanho={140}
              fatias={byType.map((t, i) => ({
                nome: t.name,
                valor: t.value,
                cor: CHART_COLORS[i % CHART_COLORS.length],
              }))}
            />
          ) : (
            <VazioDoBloco>Nenhuma atividade no período.</VazioDoBloco>
          )}
        </CartaoDeRelatorio>
      </GradeDeRelatorio>
    </div>
  );
}
