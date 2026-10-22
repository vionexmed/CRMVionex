import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { DealQualification } from "@/components/crm/DealQualification";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, XCircle, Building2, User, Edit2, Check, X, Trash2, Loader2, MoreHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useDeal, useUpdateDeal, useUpdateDealStatus, useUpdateDealStage, useDeleteDeal, dealsKeys,
} from "@/hooks/queries/useDeals";
import { dealsApi } from "@/lib/api/deals";
import { mensagemErro } from "@/lib/erro-supabase";
import {
  ATIVIDADE_ICONE, ATIVIDADE_ROTULO, ATIVIDADE_JA_ACONTECEU, ATIVIDADE_TIPOS_MANUAIS,
} from "@/lib/atividade-tipos";
import {
  useDealActivities, useCreateActivity, useUpdateActivity, useDeleteActivities, activitiesKeys,
} from "@/hooks/queries/useActivities";
import { useLossReasons } from "@/hooks/queries/useLossReasons";
import { OrcamentosDoNegocio } from "@/components/orcamentos/OrcamentosDoNegocio";
import { usePipelineStages } from "@/hooks/queries/usePipelines";
import { useMembers } from "@/hooks/queries/useMembers";
import { useCompanies } from "@/hooks/queries/useCompanies";
import { ContactDrawer } from "@/components/crm/ContactDrawer";
import { useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { formatarData, formatarDataHoraCurta, formatarMoeda } from "@/lib/formato";
import { SeloDeNegocio } from "@/components/crm/SeloDeNegocio";
import { EmailComposeModal } from "@/components/crm/EmailComposeModal";
import { Iniciais } from "@/components/layout/ListaV1";
import {
  AcoesRapidas, AlertaDeAtraso, FatosDoNegocio, TrilhaDeEtapas,
} from "@/components/negocios/ResumoDoNegocio";
import { montarAcoesRapidas, type TipoParaRegistrar } from "@/components/negocios/acoes-rapidas";
import { ReagendarAtividade } from "@/components/negocios/ReagendarAtividade";
import { etapasEmOrdem, identidadeDoNegocio, proximaAtividade } from "@/components/negocios/sinais";
import type { AtividadeDoNegocio } from "@/lib/api/deals";

type ActivityType = Database["public"]["Enums"]["activity_type"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];


// Ícones e rótulos vêm de lib/atividade-tipos.ts. Estavam declarados aqui e em
// mais cinco arquivos, e as cópias já haviam divergido.
const activityIcons = ATIVIDADE_ICONE;
const activityLabels = ATIVIDADE_ROTULO;

/** Tipos que se agendam (têm "Quando"). Os outros só registram o que já houve. */
const TIPOS_COM_QUANDO: ActivityType[] = ["task", "meeting", "call"];

/** `?registrar=` que as ações rápidas do painel do quadro mandam para cá. */
const PARA_REGISTRAR: TipoParaRegistrar[] = ["note", "call", "task"];

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orgId } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: deal, isLoading: dealLoading, isError: dealError, refetch: refetchDeal } = useDeal(id);
  const { data: activities = [] } = useDealActivities(id);
  const { data: stages = [] } = usePipelineStages();
  // O responsável vem daqui, não por embed: não existe FK deals->profiles.
  // Mesmo join cliente-side de Deals.tsx. Ver o comentário em lib/api/deals.ts.
  const { data: members = [] } = useMembers();
  const { data: companies = [] } = useCompanies();
  // Ativas para o modal escolher; a lista COMPLETA (inclui desativadas) para
  // achar o rótulo de um negócio já perdido, cujo motivo a org pode ter
  // desativado depois. Ver src/hooks/queries/useLossReasons.ts.
  const { data: lossReasons, isLoading: lossReasonsLoading, isError: lossReasonsIsError } = useLossReasons(true);
  const { data: allLossReasons = [] } = useLossReasons(false);

  const updateDeal = useUpdateDeal();
  const updateDealStatus = useUpdateDealStatus();
  const updateDealStage = useUpdateDealStage();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivities = useDeleteActivities();
  /** Atividade aguardando confirmação de exclusão (diálogo, não window.confirm). */
  const [atividadeParaExcluir, setAtividadeParaExcluir] = useState<{ id: string; title: string | null } | null>(null);

  // Inline edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingValue, setEditingValue] = useState(false);
  const [valueDraft, setValueDraft] = useState("");
  const [currencyDraft, setCurrencyDraft] = useState("BRL");

  // Loss modal
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossNote, setLossNote] = useState("");

  /**
   * Exclusão em duas etapas.
   *
   * `activities.deal_id` não tem ON DELETE, então o banco recusa apagar um
   * negócio com histórico. Contar antes deixa a tela dizer o que vai embora, em
   * vez de o Postgres recusar com "violates foreign key constraint" -- que era o
   * que aparecia como "[object Object]" antes de existir mensagemErro.
   */
  const [exclusao, setExclusao] = useState<{ atividades: number } | null>(null);
  const { mutateAsync: excluirNegocio, isPending: excluindo } = useDeleteDeal();

  const pedirExclusao = async () => {
    if (!id) return;
    try {
      const vinculos = await dealsApi.contarVinculos(id);
      // Confirmação só quando há o que perder. Perguntar para operação sem
      // consequência treina as pessoas a clicar sem ler.
      if (vinculos.atividades === 0) {
        await executarExclusao(false);
        return;
      }
      setExclusao(vinculos);
    } catch (e: unknown) {
      toast({ title: "Erro ao verificar vínculos", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const executarExclusao = async (comVinculos: boolean) => {
    if (!id) return;
    try {
      await excluirNegocio({ id, comVinculos });
      setExclusao(null);
      toast({ title: "Negócio excluído" });
      navigate("/deals");
    } catch (e: unknown) {
      toast({ title: "Erro ao excluir negócio", description: mensagemErro(e), variant: "destructive" });
    }
  };

  // Painel da pessoa. O contato já vem no embed do negócio.
  const [contatoNoPainel, setContatoNoPainel] = useState<ContactRow | null>(null);

  // Add activity
  const [activityForm, setActivityForm] = useState({ type: "note" as ActivityType, title: "", body: "", quando: "" });
  const tituloDaAtividade = useRef<HTMLInputElement>(null);
  const [escrevendoEmail, setEscrevendoEmail] = useState(false);
  const [paraReagendar, setParaReagendar] = useState<AtividadeDoNegocio | null>(null);

  /**
   * Nota, Ligar e Tarefa: o formulário de atividade, já no tipo, com o cursor
   * no título. É o mesmo formulário de sempre -- as ações rápidas são atalho
   * para ele, não um segundo caminho de gravação com regras próprias.
   */
  const registrar = (tipo: TipoParaRegistrar) => {
    setActivityForm((f) => ({ ...f, type: tipo }));
    // Depois do render: o campo "Quando" pode aparecer e empurrar o título.
    requestAnimationFrame(() => {
      tituloDaAtividade.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      tituloDaAtividade.current?.focus();
    });
  };

  // Vindo do painel do quadro com `?registrar=call`: abre direto no tipo. O
  // parâmetro sai da URL em seguida, senão recarregar repetiria o atalho.
  const [searchParams, setSearchParams] = useSearchParams();
  const registrarNaUrl = searchParams.get("registrar") as TipoParaRegistrar | null;
  useEffect(() => {
    if (!registrarNaUrl || !PARA_REGISTRAR.includes(registrarNaUrl) || dealLoading) return;
    registrar(registrarNaUrl);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("registrar");
      return next;
    }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrarNaUrl, dealLoading]);

  // Só redireciona quando o negócio REALMENTE não existe.
  //
  // Antes a condição era `!dealLoading && !deal`, que junta duas coisas
  // diferentes: negócio apagado e consulta que falhou. Com o embed impossível de
  // owner, a consulta falhava sempre -- e o usuário era devolvido para a lista
  // como se o clique não tivesse acontecido. Nunca aparecia um erro.
  //
  // `maybeSingle()` devolve null para inexistente e lança para falha, então
  // `deal === null` com `!dealError` é a única leitura segura de "não existe".
  useEffect(() => {
    if (!dealLoading && !dealError && deal === null) {
      navigate("/deals");
    }
  }, [deal, dealLoading, dealError, navigate]);

  if (dealLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Falha tem tela própria. Sem isto, qualquer erro futuro volta a se manifestar
  // como "clico e não acontece nada", que é indepurável de fora.
  if (dealError) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <XCircle className="mx-auto h-10 w-10 text-destructive" />
        <div className="space-y-1">
          <h2 className="vx-titulo-painel">Não foi possível carregar o negócio</h2>
          <p className="text-sm text-muted-foreground">
            A consulta ao banco falhou. O negócio não foi alterado.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={() => refetchDeal()}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => navigate("/deals")}>
            Voltar para Negócios
          </Button>
        </div>
      </div>
    );
  }

  if (!deal) return null;

  // Health indicator based on last activity
  const lastActivity = activities[0];
  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.created_at!).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const healthColor = daysSinceActivity <= 3 ? "bg-success" : daysSinceActivity <= 7 ? "bg-warning" : "bg-destructive";
  const healthLabel = daysSinceActivity <= 3 ? "Saudável" : daysSinceActivity <= 7 ? "Atenção" : "Inativo";

  // Só as etapas DO FUNIL DESTE NEGÓCIO.
  //
  // `usePipelineStages()` devolve as etapas de todos os funis da organização, e
  // `deals` não guarda pipeline_id -- o funil se descobre pela etapa atual. Com
  // a lista completa, o Select abaixo oferecia etapas de OUTRO funil e mover o
  // negócio para uma delas o reparentava em silêncio; e o índice da etapa atual
  // era contado sobre a lista misturada, então a barra de progresso não media
  // nada. Com um funil só configurado o bug é invisível, o que o torna pior.
  const currentStage = stages.find((s) => s.id === deal.stage_id);
  const pipelineStages = stages.filter((s) => s.pipeline_id === currentStage?.pipeline_id);

  const saveTitle = () => {
    if (!titleDraft.trim()) return;
    updateDeal.mutate(
      { id: deal.id, deal: { title: titleDraft } },
      {
        onSuccess: () => {
          setEditingTitle(false);
          toast({ title: "Título atualizado" });
        },
      }
    );
  };

  const saveValue = () => {
    const val = Number(valueDraft) || 0;
    updateDeal.mutate(
      { id: deal.id, deal: { value: val, currency: currencyDraft } },
      {
        onSuccess: () => {
          setEditingValue(false);
          toast({ title: "Valor atualizado" });
        },
      }
    );
  };

  const changeStage = (stageId: string) => {
    updateDealStage.mutate(
      { id: deal.id, stageId },
      { onSuccess: () => toast({ title: "Estágio atualizado" }) }
    );
  };

  const markAsWon = () => {
    updateDealStatus.mutate(
      { id: deal.id, status: "won" },
      { onSuccess: () => toast({ title: "Negócio marcado como ganho! 🎉" }) }
    );
  };

  const confirmLoss = () => {
    // `loss_reason_id` carrega a categoria, `loss_reason` só a nota -- sem
    // concatenar. Ver dealsApi.updateStatus.
    updateDealStatus.mutate(
      { id: deal.id, status: "lost", lossReasonId, lossReasonNote: lossNote || null },
      {
        onSuccess: () => {
          setLossModalOpen(false);
          toast({ title: "Negócio marcado como perdido" });
        },
      }
    );
  };

  // "Quando" só faz sentido para o que se agenda. Nota e e-mail registram algo
  // que já aconteceu, e um prazo neles viraria um vencimento que ninguém cumpre.
  const tipoAgendavel = TIPOS_COM_QUANDO.includes(activityForm.type);
  // Com prazo, o item é agendamento; sem, é registro. Mesma regra de Activities.
  const comPrazo = tipoAgendavel && !!activityForm.quando;

  const addActivity = () => {
    if (!orgId || !activityForm.title) return;
    createActivity.mutate(
      {
        org_id: orgId,
        deal_id: deal.id,
        // O contato TAMBÉM, e é a correção do "Sem lead vinculado" no painel.
        //
        // Só `deal_id` era gravado, então o drill-down -- que junta por
        // `contact_id` -- não achava a pessoa e rotulava toda linha como sem
        // lead. O negócio já sabe de quem é; deixar o campo vazio era jogar fora
        // informação que estava na mão.
        contact_id: deal.contact_id,
        type: activityForm.type,
        title: activityForm.title,
        body: activityForm.body,
        user_id: user?.id,
        // Este formulário REGISTRA o que aconteceu -- não tem campo de prazo.
        // Sem gravar a conclusão, três coisas quebravam ao mesmo tempo:
        //
        //   - "Abordagens realizadas" no painel exige completed_at, então a
        //     ligação que alguém registrava aqui NÃO era contada;
        //   - a tela de Atividades mostrava tudo como pendente para sempre,
        //     porque o checkbox e o cálculo de atraso olham completed_at;
        //   - o card do kanban não tinha como saber se algo de fato aconteceu.
        //
        // `task` fica de fora: tarefa é o que falta fazer, e marcá-la concluída
        // ao criar apagaria a única coisa que ela informa.
        //
        // Se a pessoa preencheu "Quando", é agendamento: reunião marcada para
        // sexta não pode contar como reunião feita hoje.
        due_date: comPrazo ? new Date(activityForm.quando).toISOString() : null,
        completed_at: !comPrazo && ATIVIDADE_JA_ACONTECEU.includes(activityForm.type)
          ? new Date().toISOString()
          : null,
      },
      {
        onError: (e) => toast({ title: "Erro ao adicionar atividade", description: mensagemErro(e), variant: "destructive" }),
        onSuccess: () => {
          setActivityForm({ type: "note", title: "", body: "", quando: "" });
          qc.invalidateQueries({ queryKey: activitiesKeys.byDeal(deal.id) });
          toast({ title: "Atividade adicionada" });
        },
      }
    );
  };

  const alternarConclusao = (a: { id: string; completed_at: string | null }) => {
    const concluir = !a.completed_at;
    updateActivity.mutate(
      { id: a.id, activity: { completed_at: concluir ? new Date().toISOString() : null } },
      {
        onSuccess: () => toast({ title: concluir ? "Atividade concluída" : "Atividade reaberta" }),
        onError: (e) => toast({ title: "Erro ao atualizar atividade", description: mensagemErro(e), variant: "destructive" }),
      },
    );
  };

  const excluirAtividade = () => {
    if (!atividadeParaExcluir) return;
    deleteActivities.mutate([atividadeParaExcluir.id], {
      onSuccess: () => {
        setAtividadeParaExcluir(null);
        toast({ title: "Atividade excluída" });
      },
      onError: (e) => toast({ title: "Erro ao excluir atividade", description: mensagemErro(e), variant: "destructive" }),
    });
  };

  const contact = deal.contact ?? null;
  const company = deal.company ?? null;
  // Join cliente-side, porque o embed é impossível (ver lib/api/deals.ts).
  const owner = members.find((m) => m.id === deal.owner_id) ?? null;

  // Só as etapas deste funil, em ordem, para a trilha.
  const etapasEmTrilha = etapasEmOrdem(pipelineStages);
  const identidade = identidadeDoNegocio(deal);
  const proxima = proximaAtividade(activities);
  const prob = Number(deal.probability) || 0;
  const probEtapa = Number(currentStage?.win_probability) || 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={() => navigate("/deals")} className="flex min-h-8 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Voltar para Negócios
      </button>

      {/*
        O RESUMO NO DESENHO DO PAINEL DO V1: identidade, valor, ganho/perda,
        trilha de etapas, fatos, alerta de atraso e ações rápidas -- as mesmas
        peças do painel ao lado do quadro (components/negocios), para as duas
        telas não divergirem.

        A trilha substituiu o select de etapa E a barra de progresso: eram dois
        controles para a mesma coisa, e a barra clicável não dizia o nome de
        etapa nenhuma.
      */}
      <section aria-label="Resumo do negócio" className="space-y-5 rounded-lg bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Iniciais nome={identidade.nomeIniciais} forma={identidade.forma} tamanho="lg" />
            <div className="min-w-0 flex-1 space-y-1">
              {/* Inline title */}
              {editingTitle ? (
                <div className="flex items-center gap-1">
                  <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="h-auto py-0.5 text-2xl font-bold" autoFocus onKeyDown={(e) => e.key === "Enter" && saveTitle()} />
                  <Button variant="ghost" size="icon" onClick={saveTitle} aria-label="Salvar título" className="text-success"><Check className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingTitle(false); setTitleDraft(deal.title); }} aria-label="Cancelar" className="text-muted-foreground"><X className="h-5 w-5" /></Button>
                </div>
              ) : (
                <h1 className="vx-titulo-tela group cursor-pointer" onClick={() => { setTitleDraft(deal.title); setEditingTitle(true); }}>
                  {deal.title}
                  <Edit2 className="ml-2 inline h-4 w-4 opacity-0 transition-opacity group-hover:opacity-50" />
                </h1>
              )}
              <p className="truncate text-xs text-muted-foreground">
                {[company?.name, identidade.nomeContato].filter(Boolean).join(" · ") || "Sem empresa ou contato"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {deal.status === "open" && (
              <>
                <Button onClick={markAsWon} className="bg-success text-success-foreground hover:bg-success/90">
                  Marcar ganho
                </Button>
                <Button variant="outline" onClick={() => { setLossReasonId(""); setLossNote(""); setLossModalOpen(true); }} className="border-destructive/40 text-destructive hover:bg-destructive-soft">
                  Perdido
                </Button>
              </>
            )}
            {/* Excluir existe para negócio fechado também: é justamente o
                duplicado ou o de teste que se quer tirar do caminho. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={pedirExclusao}
              aria-label="Excluir negócio"
              title="Excluir negócio"
              className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Inline value */}
        <div className="flex flex-wrap items-center gap-3">
          {editingValue ? (
            <div className="flex items-center gap-2">
              <Select value={currencyDraft} onValueChange={setCurrencyDraft}>
                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" value={valueDraft} onChange={(e) => setValueDraft(e.target.value)} className="h-8 w-32" autoFocus onKeyDown={(e) => e.key === "Enter" && saveValue()} />
              <Button variant="ghost" size="icon" onClick={saveValue} aria-label="Salvar valor" className="text-success"><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setEditingValue(false)} aria-label="Cancelar" className="text-muted-foreground"><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <button
              type="button"
              title="Editar valor"
              className="text-2xl font-bold tabular-nums tracking-tight text-foreground hover:text-primary"
              onClick={() => { setValueDraft(String(deal.value || 0)); setCurrencyDraft(deal.currency || "BRL"); setEditingValue(true); }}
            >
              {formatarMoeda(Number(deal.value) || 0, deal.currency || "BRL")}
            </button>
          )}

          {/* Status badge */}
          {deal.status !== "open" && <SeloDeNegocio status={deal.status} />}

          {/* Health */}
          <div className="flex items-center gap-1.5" title="Pela última atividade registrada">
            <div className={`h-2 w-2 rounded-full ${healthColor}`} />
            <span className="text-xs text-muted-foreground">{healthLabel}</span>
          </div>
        </div>

        {etapasEmTrilha.length > 0 && (
          <TrilhaDeEtapas
            etapas={etapasEmTrilha}
            atualId={deal.stage_id}
            status={deal.status}
            onEscolher={changeStage}
          />
        )}

        <div className="grid gap-5 border-t border-border pt-5 lg:grid-cols-2">
          <FatosDoNegocio fatos={[
            // Join cliente-side do responsável: não existe FK deals->profiles.
            { rotulo: "Responsável", valor: owner?.name || "Sem responsável" },
            { rotulo: "Previsão de fechamento", valor: deal.close_date ? formatarData(deal.close_date) : "—" },
            { rotulo: "Origem", valor: identidade.origem ?? "—" },
            // A do negócio quando alguém a definiu; senão a da etapa, dita como tal.
            { rotulo: "Probabilidade", valor: prob > 0 ? `${prob}%` : probEtapa > 0 ? `${probEtapa}% (da etapa)` : "—" },
          ]} />
          <div className="space-y-3">
            {proxima?.atrasada && (
              <AlertaDeAtraso proxima={proxima} onReagendar={() => setParaReagendar(proxima.atividade)} />
            )}
            <AcoesRapidas acoes={montarAcoesRapidas({
              deal,
              registrar,
              escreverEmail: () => setEscrevendoEmail(true),
            })} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content: Timeline */}
        <div className="space-y-4 lg:col-span-2">
          {/* Add activity form */}
          <Card>
            <CardHeader>
              <CardTitle className="font-medium">Adicionar Atividade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Select value={activityForm.type} onValueChange={(v) => setActivityForm({ ...activityForm, type: v as ActivityType })}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {/* A lista compartilhada. Esta cópia escrevia "Email" sem
                        hífen, enquanto o resto do CRM escreve "E-mail" -- a
                        divergência exata que `atividade-tipos.ts` existe para
                        acabar. E `MANUAIS` exclui orçamento, que o sistema grava. */}
                    {ATIVIDADE_TIPOS_MANUAIS.map((t) => (
                      <SelectItem key={t} value={t}>{ATIVIDADE_ROTULO[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input ref={tituloDaAtividade} className="h-8 text-sm" placeholder="Título" value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} />
              </div>
              {tipoAgendavel && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="atividade-quando" className="text-xs text-muted-foreground">Quando</Label>
                  <Input
                    id="atividade-quando"
                    type="datetime-local"
                    className="h-8 w-52 text-xs"
                    value={activityForm.quando}
                    onChange={(e) => setActivityForm({ ...activityForm, quando: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {activityForm.quando
                      ? "Fica pendente até ser concluída"
                      : activityForm.type === "task" ? "Sem prazo" : "Vazio: registra como já realizada"}
                  </span>
                </div>
              )}
              <Textarea placeholder="Descrição (opcional)" value={activityForm.body} onChange={(e) => setActivityForm({ ...activityForm, body: e.target.value })} rows={2} className="text-sm" />
              <Button size="sm" onClick={addActivity} disabled={!activityForm.title || createActivity.isPending}>Adicionar</Button>
            </CardContent>
          </Card>

          {/* Timeline */}
          <div className="space-y-1">
            {activities.map((a) => {
              const Icon = activityIcons[a.type];
              return (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    className="mt-2"
                    aria-label={a.completed_at ? "Reabrir atividade" : "Marcar como concluída"}
                    checked={!!a.completed_at}
                    onCheckedChange={() => alternarConclusao(a)}
                  />
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-muted-foreground">{activityLabels[a.type]}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatarDataHoraCurta(a.created_at!)}
                      </span>
                    </div>
                    <p className={`text-sm font-medium ${a.completed_at ? "text-muted-foreground line-through" : ""}`}>{a.title}</p>
                    {a.due_date && (
                      <p className={`text-xs ${!a.completed_at && new Date(a.due_date) < new Date() ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                        Para {formatarDataHoraCurta(a.due_date)}
                      </p>
                    )}
                    {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Ações da atividade"
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAtividadeParaExcluir({ id: a.id, title: a.title })} className="text-destructive">
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
            {activities.length === 0 && (
              <div className="py-10 text-center text-muted-foreground text-sm">Nenhuma atividade registrada</div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Os orcamentos deste negocio. Ficam ANTES da qualificacao porque
              proposta enviada e o fato mais acionavel da coluna: quem abre o
              negocio precisa saber se ja mandou uma antes de mandar outra. */}
          <OrcamentosDoNegocio dealId={deal.id} contactId={deal.contact_id} />

          {/* BANT Qualification */}
          <DealQualification
            dealId={deal.id}
            qualification={deal.qualification}
            onUpdate={() => qc.invalidateQueries({ queryKey: ["deals", "detail", deal.id] })}
          />
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-medium text-muted-foreground">
                <User className="h-4 w-4" />Contato
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact ? (
                // Clicável: abre o painel da pessoa. Antes era um cartão morto --
                // o nome estava ali e não levava a lugar nenhum, então para ver o
                // histórico dela era preciso ir a Contatos e buscar pelo nome.
                <button
                  type="button"
                  onClick={() => setContatoNoPainel(contact)}
                  className="flex w-full items-center gap-2 rounded-md p-1 text-left transition-colors hover:bg-accent/40"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {contact.first_name?.[0] || "?"}{contact.last_name?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{contact.first_name} {contact.last_name}</p>
                    {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                  </div>
                </button>
              ) : <p className="text-sm text-muted-foreground">Nenhum contato vinculado</p>}
            </CardContent>
          </Card>

          {/* Company */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {company ? (
                <div>
                  <p className="text-sm font-medium">{company.name}</p>
                  {company.domain && <p className="text-xs text-muted-foreground">{company.domain}</p>}
                </div>
              ) : <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada</p>}
            </CardContent>
          </Card>

          {/* Responsável, fechamento e probabilidade subiram para os fatos do
              resumo, no topo. Aqui fica o que só interessa de vez em quando. */}
          <Card>
            <CardHeader>
              <CardTitle className="font-medium text-muted-foreground">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>{deal.created_at ? formatarData(deal.created_at) : "—"}</span>
              </div>
              {(deal.loss_reason_id || deal.loss_reason) && (() => {
                // Prefere o rótulo do catálogo (via FK); linhas antigas nunca
                // backfilled não têm `loss_reason_id` e caem no texto legado --
                // que pode ser o antigo "Categoria: nota" concatenado. Nenhum
                // dos dois é descartado.
                const categoria = deal.loss_reason_id
                  ? allLossReasons.find((r) => r.id === deal.loss_reason_id)?.label
                  : null;
                return (
                  <div className="mt-2 space-y-0.5 rounded-md bg-destructive-soft p-2">
                    <p className="text-xs font-medium text-destructive">Motivo da perda:</p>
                    <p className="text-xs text-destructive">{categoria ?? deal.loss_reason}</p>
                    {categoria && deal.loss_reason && (
                      <p className="text-xs text-destructive">{deal.loss_reason}</p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Loss Reason Modal */}
      <Dialog open={lossModalOpen} onOpenChange={setLossModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da Perda</DialogTitle>
            <DialogDescription>Por que este negócio foi perdido?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              {lossReasonsLoading ? (
                <p className="text-xs text-muted-foreground">Carregando motivos...</p>
              ) : lossReasonsIsError ? (
                <p className="text-xs text-destructive">Não foi possível carregar os motivos cadastrados.</p>
              ) : !lossReasons?.length ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum motivo cadastrado para esta organização. Cadastre em Configurações → Funis e Etapas.
                </p>
              ) : (
                <Select value={lossReasonId} onValueChange={setLossReasonId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar motivo" /></SelectTrigger>
                  <SelectContent>
                    {lossReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={lossNote} onChange={(e) => setLossNote(e.target.value)} placeholder="Detalhes..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmLoss} disabled={!lossReasonId}>Confirmar Perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O drawer escreve direto no supabase, fora do react-query: `onUpdate`
          precisa invalidar o negócio TAMBÉM, senão o cartão de contato aqui
          continuaria mostrando o nome antigo depois de editar. */}
      <ContactDrawer
        contact={contatoNoPainel}
        onClose={() => setContatoNoPainel(null)}
        onUpdate={() => {
          qc.invalidateQueries({ queryKey: ["contacts"] });
          qc.invalidateQueries({ queryKey: dealsKeys.detail(id ?? "") });
        }}
        companies={companies}
      />

      {/* E-mail das ações rápidas: o compositor do CRM, amarrado à pessoa e ao
          negócio, então o envio entra na linha do tempo abaixo. */}
      <EmailComposeModal
        open={escrevendoEmail}
        onOpenChange={setEscrevendoEmail}
        defaultTo={contact?.email || ""}
        defaultContactId={deal.contact_id || undefined}
        defaultDealId={deal.id}
        onSent={() => {
          setEscrevendoEmail(false);
          qc.invalidateQueries({ queryKey: activitiesKeys.byDeal(deal.id) });
          qc.invalidateQueries({ queryKey: ["deals"] });
        }}
      />

      <ReagendarAtividade atividade={paraReagendar} onFechar={() => setParaReagendar(null)} />

      <Dialog open={!!atividadeParaExcluir} onOpenChange={(o) => !o && setAtividadeParaExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir esta atividade?</DialogTitle>
            <DialogDescription>
              “{atividadeParaExcluir?.title}” deixa de existir no histórico do negócio. Isto não pode ser desfeito.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtividadeParaExcluir(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteActivities.isPending} onClick={excluirAtividade}>
              {deleteActivities.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação nomeando o que será apagado.
          Sem transação no PostgREST: as atividades vão antes do negócio, e se o
          último passo falhar sobra um negócio sem histórico. Por isso a contagem
          aparece aqui, e não um "tem certeza?" genérico. */}
      <Dialog open={!!exclusao} onOpenChange={(o) => !o && setExclusao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir este negócio?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Isto vai apagar também{" "}
                  <strong>
                    {exclusao?.atividades} atividade
                    {exclusao?.atividades !== 1 ? "s" : ""}
                  </strong>{" "}
                  — ligações, reuniões e notas registradas neste negócio.
                </p>
                <p className="text-muted-foreground">
                  O contato continua no CRM, e e-mails e mensagens de WhatsApp são
                  preservados — apenas deixam de estar vinculados. Nada disso pode ser
                  desfeito.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExclusao(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={excluindo} onClick={() => executarExclusao(true)}>
              {excluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
