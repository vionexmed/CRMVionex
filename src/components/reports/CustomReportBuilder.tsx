import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CartaoDeRelatorio } from "@/components/reports/CartaoDeRelatorio";
import { LIFECYCLE_LABELS, type LifecycleStage } from "@/lib/contact-options";
import { ATIVIDADE_ROTULO, type ActivityType } from "@/lib/atividade-tipos";
import {
  Deal, Contact, ActivityRow, Stage, Profile,
  fmt, downloadCSV,
} from "@/components/reports/types";

const STATUS_DO_NEGOCIO: Record<string, string> = { open: "Em aberto", won: "Ganho", lost: "Perdido" };

export function CustomReportBuilder({ deals, contacts, activities, stages, members, orgId }: {
  deals: Deal[]; contacts: Contact[]; activities: ActivityRow[]; stages: Stage[]; members: Profile[]; orgId: string;
}) {
  const { toast } = useToast();
  const [entity, setEntity] = useState<"deals" | "contacts" | "activities">("deals");
  const [savedReports, setSavedReports] = useState<{ id: string; name: string; entity: string; fields: string[]; filters: any }[]>([]);
  const [reportName, setReportName] = useState("");

  const fieldOptions: Record<string, { key: string; label: string }[]> = {
    deals: [
      { key: "title", label: "Título" }, { key: "value", label: "Valor" }, { key: "status", label: "Status" },
      { key: "stage", label: "Etapa" }, { key: "owner", label: "Dono" }, { key: "probability", label: "Prob %" },
      { key: "close_date", label: "Data Fechamento" }, { key: "loss_reason", label: "Motivo Perda" },
      { key: "created_at", label: "Criado em" },
    ],
    contacts: [
      { key: "name", label: "Nome" }, { key: "estagio", label: "Ciclo de vida" }, { key: "lead_score", label: "Score" },
      { key: "owner", label: "Dono" }, { key: "created_at", label: "Criado em" },
    ],
    activities: [
      { key: "title", label: "Título" }, { key: "type", label: "Tipo" }, { key: "user", label: "Responsável" },
      { key: "completed", label: "Concluída" }, { key: "created_at", label: "Criado em" },
    ],
  };

  const [selectedFields, setSelectedFields] = useState<string[]>(fieldOptions.deals.map((f) => f.key));

  const toggleField = (key: string) => {
    setSelectedFields((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  useEffect(() => {
    setSelectedFields(fieldOptions[entity].map((f) => f.key));
  }, [entity]);

  // Load saved reports
  useEffect(() => {
    supabase.from("segments").select("*").eq("org_id", orgId).then(({ data }) => {
      // Reuse segments table with a convention
      const reports = (data || []).filter((s: any) => {
        try { return JSON.parse(JSON.stringify(s.filters))?.type === "custom_report"; } catch { return false; }
      }).map((s: any) => ({
        id: s.id, name: s.name,
        entity: (s.filters as any)?.entity || "deals",
        fields: (s.filters as any)?.fields || [],
        filters: s.filters,
      }));
      setSavedReports(reports);
    });
  }, [orgId]);

  // Generate table data
  const tableData = useMemo(() => {
    if (entity === "deals") {
      return deals.map((d) => ({
        // O valor cru ("won", "lost") vazava em inglês para a prévia e o CSV.
        title: d.title, value: fmt(Number(d.value) || 0), status: STATUS_DO_NEGOCIO[d.status ?? ""] ?? d.status ?? "—",
        stage: stages.find((s) => s.id === d.stage_id)?.name || "—",
        owner: members.find((m) => m.id === d.owner_id)?.name || "—",
        probability: `${d.probability || 0}%`, close_date: d.close_date || "—",
        loss_reason: d.loss_reason || "—", created_at: d.created_at?.slice(0, 10) || "—",
      }));
    } else if (entity === "contacts") {
      return contacts.map((c) => ({
        name: `${c.first_name} ${c.last_name || ""}`.trim(),
        // Estágio do ciclo de vida, com o rótulo que a interface usa. Lia a
        // coluna legada `status`, que mostra 4 grupos onde existem 6, e ainda
        // imprimia o valor cru em inglês.
        estagio: LIFECYCLE_LABELS[(c.lifecycle_stage || "lead") as LifecycleStage],
        lead_score: String(c.lead_score || 0),
        owner: members.find((m) => m.id === c.owner_id)?.name || "—",
        created_at: c.created_at?.slice(0, 10) || "—",
      }));
    } else {
      return activities.map((a) => ({
        title: a.title, type: ATIVIDADE_ROTULO[a.type as ActivityType] || a.type,
        user: members.find((m) => m.id === a.user_id)?.name || "—",
        completed: a.completed_at ? "Sim" : "Não",
        created_at: a.created_at?.slice(0, 10) || "—",
      }));
    }
  }, [entity, deals, contacts, activities, stages, members, selectedFields]);

  const exportCSV = () => {
    const filtered = tableData.map((row) => {
      const obj: Record<string, any> = {};
      selectedFields.forEach((f) => { obj[fieldOptions[entity].find((fo) => fo.key === f)?.label || f] = (row as any)[f]; });
      return obj;
    });
    downloadCSV(filtered, `relatorio-${entity}`);
    toast({ title: "CSV exportado!" });
  };

  const saveReport = async () => {
    if (!reportName.trim()) { toast({ title: "Informe um nome", variant: "destructive" }); return; }
    const { error } = await supabase.from("segments").insert({
      org_id: orgId, name: reportName,
      filters: { type: "custom_report", entity, fields: selectedFields } as any,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Relatório salvo!" });
    setReportName("");
  };

  const loadReport = (r: typeof savedReports[0]) => {
    setEntity(r.entity as any);
    setSelectedFields(r.fields);
  };

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="min-w-0 self-start">
        <CardHeader>
          <CardTitle>Montar relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="relatorio-entidade" className="text-xs">Entidade</Label>
            <Select value={entity} onValueChange={(v) => setEntity(v as typeof entity)}>
              <SelectTrigger id="relatorio-entidade" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deals">Negócios</SelectItem>
                <SelectItem value="contacts">Contatos</SelectItem>
                <SelectItem value="activities">Atividades</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Campos</p>
            <div className="flex flex-wrap gap-1.5">
              {fieldOptions[entity].map((f) => (
                <Button
                  type="button" size="sm" aria-pressed={selectedFields.includes(f.key)}
                  key={f.key}
                  variant={selectedFields.includes(f.key) ? "default" : "outline"}
                  className="h-auto min-h-8 whitespace-normal text-left"
                  onClick={() => toggleField(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Input
              aria-label="Nome do relatório"
              placeholder="Nome do relatório"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={saveReport}>Salvar</Button>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download aria-hidden />Exportar CSV
              </Button>
            </div>
          </div>

          {savedReports.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">Salvos</p>
              <div className="flex flex-wrap gap-1">
                {savedReports.map((r) => (
                  <Button type="button" size="sm" key={r.id} variant="ghost" className="h-auto min-h-8 whitespace-normal text-left" onClick={() => loadReport(r)}>
                    {r.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CartaoDeRelatorio
        titulo="Prévia do relatório"
        descricao={`${tableData.length} registros · ${selectedFields.length} campos selecionados`}
        rente
      >
        <div className="vx-table max-h-[500px] rounded-none border-x-0 border-b-0">
          <Table>
            <TableHeader>
              <TableRow>
                {selectedFields.map((f) => (
                  <TableHead key={f} className="whitespace-nowrap">
                    {fieldOptions[entity].find((fo) => fo.key === f)?.label || f}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.length === 0 && <TableRow><TableCell colSpan={Math.max(1, selectedFields.length)} className="text-xs text-muted-foreground">Nenhum registro para esta entidade.</TableCell></TableRow>}
              {tableData.slice(0, 100).map((row, i) => (
                <TableRow key={i}>
                  {selectedFields.map((f) => (
                    <TableCell key={f} className="whitespace-nowrap text-xs">{(row as any)[f]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {tableData.length > 100 && (
          <p className="border-t border-border py-2 text-center text-xs text-muted-foreground">Mostrando 100 de {tableData.length} registros. Exporte o CSV para ver todos.</p>
        )}
      </CartaoDeRelatorio>
    </div>
  );
}
