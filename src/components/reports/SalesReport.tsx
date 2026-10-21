import { useState, useMemo } from "react";
import { FaixaDeIndicadores, Indicador, Iniciais } from "@/components/layout/ListaV1";
import { CartaoDeRelatorio, GradeDeRelatorio, VazioDoBloco } from "@/components/reports/CartaoDeRelatorio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RoscaComLegenda } from "@/components/dashboard/svg/RoscaComLegenda";
import { BarrasAgrupadas } from "@/components/dashboard/svg/BarrasAgrupadas";
import {
  Download,
} from "lucide-react";
import {
  Deal, Stage, Profile, Company,
  fmt, pct, CHART_COLORS, MONTHS_PT,
  downloadCSV,
} from "@/components/reports/types";

type Agrupamento = "stage" | "owner" | "company" | "month";

export function SalesReport({ deals, stages, members, companies }: {
  deals: Deal[]; stages: Stage[]; members: Profile[]; companies: Company[];
}) {
  const [groupBy, setGroupBy] = useState<Agrupamento>("stage");
  const { toast } = useToast();

  const wonDeals = deals.filter((d) => d.status === "won");
  const lostDeals = deals.filter((d) => d.status === "lost");
  const openDeals = deals.filter((d) => d.status === "open");
  const totalClosed = wonDeals.length + lostDeals.length;
  const winRate = pct(wonDeals.length, totalClosed);
  const wonValue = wonDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const avgTicket = wonDeals.length > 0 ? wonValue / wonDeals.length : 0;

  // Avg cycle
  const avgCycle = useMemo(() => {
    if (wonDeals.length === 0) return 0;
    const total = wonDeals.reduce((s, d) => {
      const c = new Date(d.created_at!); const u = d.updated_at ? new Date(d.updated_at) : new Date();
      return s + Math.floor((u.getTime() - c.getTime()) / 86400000);
    }, 0);
    return Math.round(total / wonDeals.length);
  }, [wonDeals]);

  // Funnel
  const funnelData = useMemo(() => stages.map((s, i) => {
    const count = deals.filter((d) => d.stage_id === s.id && d.status === "open").length;
    const val = deals.filter((d) => d.stage_id === s.id && d.status === "open").reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    return { name: s.name, count, value: val, color: s.color || `var(--stage-${Math.min(i + 1, 6)})` };
  }), [stages, deals]);

  // Waterfall
  const waterfallData = useMemo(() => [
    { name: "Abertos", value: openDeals.length, fill: "hsl(var(--primary))" },
    { name: "Ganhos", value: wonDeals.length, fill: "hsl(var(--success))" },
    { name: "Perdidos", value: lostDeals.length, fill: "hsl(var(--destructive))" },
  ], [openDeals, wonDeals, lostDeals]);

  // Loss reasons
  const lossReasons = useMemo(() => {
    const map = new Map<string, number>();
    lostDeals.forEach((d) => { const r = d.loss_reason?.trim() || "Não informado"; map.set(r, (map.get(r) || 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [lostDeals]);

  // Grouped table
  const groupedData = useMemo(() => {
    const groups: Record<string, { label: string; deals: Deal[]; won: number; lost: number; value: number }> = {};
    deals.forEach((d) => {
      let key: string;
      let label: string;
      if (groupBy === "stage") {
        key = d.stage_id || "none";
        label = stages.find((s) => s.id === d.stage_id)?.name || "Sem etapa";
      } else if (groupBy === "owner") {
        key = d.owner_id || "none";
        label = members.find((m) => m.id === d.owner_id)?.name || members.find((m) => m.id === d.owner_id)?.email || "Sem dono";
      } else if (groupBy === "company") {
        key = d.company_id || "none";
        label = companies.find((c) => c.id === d.company_id)?.name || "Sem empresa";
      } else {
        const date = d.created_at ? new Date(d.created_at) : new Date();
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        label = `${MONTHS_PT[date.getMonth()]}/${date.getFullYear()}`;
      }
      if (!groups[key]) groups[key] = { label, deals: [], won: 0, lost: 0, value: 0 };
      groups[key].deals.push(d);
      if (d.status === "won") { groups[key].won++; groups[key].value += Number(d.value) || 0; }
      if (d.status === "lost") groups[key].lost++;
    });
    return Object.values(groups).sort((a, b) => b.value - a.value);
  }, [deals, groupBy, stages, members, companies]);

  // Owner performance
  const ownerStats = useMemo(() =>
    members.map((m) => {
      const md = deals.filter((d) => d.owner_id === m.id);
      const mw = md.filter((d) => d.status === "won");
      const ml = md.filter((d) => d.status === "lost");
      const mc = mw.length + ml.length;
      return {
        name: m.name || m.email || "—", total: md.length, won: mw.length, lost: ml.length,
        winRate: pct(mw.length, mc), value: mw.reduce((s, d) => s + (Number(d.value) || 0), 0),
      };
    }).filter((m) => m.total > 0).sort((a, b) => b.value - a.value),
    [members, deals]
  );

  // Conversion between stages
  const stageConversion = useMemo(() => stages.map((s, i) => {
    const count = deals.filter((d) => d.stage_id === s.id).length;
    const prevCount = i > 0 ? deals.filter((d) => d.stage_id === stages[i - 1].id).length : count;
    return { name: s.name, rate: i === 0 ? 100 : pct(count, prevCount) };
  }), [stages, deals]);

  // Avg time per stage
  const avgTimePerStage = useMemo(() => stages.map((s) => {
    const sd = deals.filter((d) => d.stage_id === s.id);
    if (sd.length === 0) return { name: s.name, days: 0 };
    const total = sd.reduce((sum, d) => {
      const c = new Date(d.created_at!); const u = d.updated_at ? new Date(d.updated_at) : new Date();
      return sum + Math.floor((u.getTime() - c.getTime()) / 86400000);
    }, 0);
    return { name: s.name, days: Math.round(total / sd.length) };
  }), [stages, deals]);

  const exportDealsCSV = () => {
    downloadCSV(deals.map((d) => ({
      Título: d.title, Valor: d.value, Status: d.status,
      Etapa: stages.find((s) => s.id === d.stage_id)?.name || "",
      Dono: members.find((m) => m.id === d.owner_id)?.name || "",
      Probabilidade: d.probability, "Data Fechamento": d.close_date,
      "Motivo Perda": d.loss_reason || "", Criado: d.created_at,
    })), "relatorio-vendas");
    toast({ title: "CSV exportado!" });
  };

  return (
    <div className="min-w-0 space-y-4">
      <FaixaDeIndicadores>
        <Indicador rotulo="Taxa de ganho" valor={`${winRate}%`} apoio={`${totalClosed} ${totalClosed === 1 ? "fechado" : "fechados"}`} />
        <Indicador rotulo="Ganhos" valor={wonDeals.length} apoio={fmt(wonValue)} tom={wonDeals.length > 0 ? "sucesso" : undefined} />
        <Indicador rotulo="Perdidos" valor={lostDeals.length} apoio={`${pct(lostDeals.length, totalClosed)}% dos fechados`} />
        <Indicador rotulo="Ticket médio" valor={fmt(avgTicket)} apoio="por negócio ganho" />
        <Indicador rotulo="Ciclo médio" valor={`${avgCycle} dias`} apoio="da criação ao ganho" />
      </FaixaDeIndicadores>

      <GradeDeRelatorio>
        <CartaoDeRelatorio
          titulo="Negócios agrupados"
          rente
          acoes={<>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as Agrupamento)}>
              <SelectTrigger aria-label="Agrupar por" className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stage">Por etapa</SelectItem>
                <SelectItem value="owner">Por responsável</SelectItem>
                <SelectItem value="company">Por empresa</SelectItem>
                <SelectItem value="month">Por mês</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportDealsCSV}>
              <Download aria-hidden />Exportar CSV
            </Button>
          </>}
        >
          <div className="vx-table rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="text-right">Perdidos</TableHead>
                  <TableHead className="text-right">Taxa de ganho</TableHead>
                  <TableHead className="text-right">Valor ganho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedData.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-xs text-muted-foreground">Nenhum negócio no período.</TableCell></TableRow>
                )}
                {groupedData.map((g) => {
                  const taxa = pct(g.won, g.won + g.lost);
                  return (
                    <TableRow key={g.label}>
                      <TableCell className="text-xs font-medium">{g.label}</TableCell>
                      <TableCell className="text-right text-xs">{g.deals.length}</TableCell>
                      <TableCell className="text-right text-xs text-success">{g.won}</TableCell>
                      <TableCell className="text-right text-xs text-destructive">{g.lost}</TableCell>
                      <TableCell className="text-right text-xs">
                        <Badge variant={taxa >= 50 ? "success" : "neutral"}>{taxa}%</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">{fmt(g.value)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CartaoDeRelatorio>

        <CartaoDeRelatorio titulo="Situação dos negócios" descricao="Quantidade por desfecho">
          {/* A cor pertence à LINHA aqui, não à série: ganho é verde,
              perdido é vermelho, aberto é a cor de destaque. */}
          <BarrasAgrupadas
            linhas={waterfallData}
            rotulo={(w) => w.name}
            formatar={(v) => String(v)}
            vazio="Nenhum negócio no período"
            series={[{ nome: "Negócios", cor: (w) => w.fill, valor: (w) => w.value }]}
          />
        </CartaoDeRelatorio>

        <CartaoDeRelatorio titulo="Negócios por etapa" descricao="Em aberto: quantidade e valor">
          {funnelData.length === 0 ? (
            <VazioDoBloco>Nenhuma etapa configurada.</VazioDoBloco>
          ) : (
            <ol className="space-y-3">
              {funnelData.map((s) => {
                const max = Math.max(...funnelData.map((f) => f.value), 1);
                return (
                  <li key={s.name} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="truncate text-xs font-medium">{s.name}</span>
                    {/* A cor é DADO, não tema: é a que o usuário escolheu para a
                        etapa em Configurações. Trilho em surface-2 porque
                        `bg-muted` some sobre o cartão no tema claro. */}
                    <div className="h-5 overflow-hidden rounded bg-surface-2">
                      <div className="h-full rounded" style={{ width: `${Math.max((s.value / max) * 100, 2)}%`, backgroundColor: s.color }} />
                    </div>
                    <span className="whitespace-nowrap text-right text-xs tabular-nums">
                      <span className="font-semibold">{s.count}</span>
                      <span className="text-muted-foreground"> · {fmt(s.value)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CartaoDeRelatorio>

        <CartaoDeRelatorio titulo="Motivos de perda">
          {lossReasons.length > 0 ? (
            <RoscaComLegenda
              tamanho={140}
              fatias={lossReasons.map((l, i) => ({
                nome: l.name,
                valor: l.value,
                cor: CHART_COLORS[i % CHART_COLORS.length],
              }))}
            />
          ) : <VazioDoBloco>Nenhuma perda registrada.</VazioDoBloco>}
        </CartaoDeRelatorio>

        <CartaoDeRelatorio titulo="Taxa de conversão por etapa" descricao="Negócios numa etapa sobre os da etapa anterior">
          <BarrasAgrupadas
            linhas={stageConversion}
            rotulo={(e) => e.name}
            formatar={(v) => `${v}%`}
            vazio="Nenhuma etapa com movimento"
            series={[{ nome: "Conversão", cor: CHART_COLORS[0], valor: (e) => e.rate }]}
          />
        </CartaoDeRelatorio>

        <CartaoDeRelatorio titulo="Tempo médio por etapa" descricao="Em dias">
          {/* Este já era `layout="vertical"` no recharts, ou seja, barras
              horizontais -- a troca não muda nada aqui. */}
          <BarrasAgrupadas
            linhas={avgTimePerStage}
            rotulo={(e) => e.name}
            formatar={(v) => `${v} d`}
            vazio="Sem tempo de permanência registrado"
            series={[{ nome: "Dias", cor: "hsl(var(--chart-3))", valor: (e) => e.days }]}
          />
        </CartaoDeRelatorio>
      </GradeDeRelatorio>

      {ownerStats.length > 0 && (
        <CartaoDeRelatorio titulo="Desempenho por responsável" rente>
          <div className="vx-table rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="text-right">Perdidos</TableHead>
                  <TableHead className="text-right">Taxa de ganho</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ownerStats.map((o) => (
                  <TableRow key={o.name}>
                    <TableCell className="text-xs">
                      <span className="flex items-center gap-2 font-medium">
                        <Iniciais nome={o.name} tamanho="sm" />{o.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs">{o.total}</TableCell>
                    <TableCell className="text-right text-xs text-success">{o.won}</TableCell>
                    <TableCell className="text-right text-xs text-destructive">{o.lost}</TableCell>
                    <TableCell className="text-right text-xs">
                      <Badge variant={o.winRate >= 50 ? "success" : "neutral"}>{o.winRate}%</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">{fmt(o.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CartaoDeRelatorio>
      )}
    </div>
  );
}
