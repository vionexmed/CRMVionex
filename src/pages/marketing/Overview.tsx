/**
 * Marketing: o que os anúncios custaram e o que trouxeram.
 *
 * VISUAL 01: a mesma linguagem do Painel e de Relatórios -- cabeçalho da casca,
 * faixa de números num cartão só, gráficos e tabela em cartões com borda e sem
 * sombra. Saíram a trilha escrita à mão (a barra superior já diz onde se está),
 * as barras coloridas no topo de cada número e a contagem animada: três
 * decorações disputando com o dado.
 *
 * A HONESTIDADE FICA. O Meta lê tabelas sincronizadas de verdade; o Google não
 * está integrado e a tela diz isso, em vez de mostrar zero. Receita que nenhuma
 * fonte atribui aparece como "—", não como R$ 0 -- zero seria afirmar que a
 * campanha não vendeu nada.
 */
import { useState, type ReactNode } from "react";
import {
  LayoutGrid, Facebook, Chrome, ArrowUpRight, RefreshCw, Calendar, Database, PlugZap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  sumBy, fmtBRL, fmtNum,
  periodDays, type PeriodKey, type FunnelStage, type Campaign,
} from "@/lib/marketing-utils";
import { useMarketingData, type MarketingSource } from "@/hooks/useMarketingData";
import { formatarHora, formatarMoeda, formatarNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/PageShell";
import { SegmentedControl } from "@/components/layout/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "@/components/layout/EstadoDaLista";
import { FaixaDeIndicadores, Indicador } from "@/components/layout/ListaV1";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AreaSeries } from "@/components/dashboard/svg/AreaSeries";
import { RoscaComLegenda } from "@/components/dashboard/svg/RoscaComLegenda";
import { BarrasAgrupadas } from "@/components/dashboard/svg/BarrasAgrupadas";

type TabKey = "visao" | "meta" | "google";

/**
 * As cores de Meta e Google são identidade de TERCEIROS (`--vx-meta`,
 * `--vx-google`): não seguem tema nem cor de destaque, e derivá-las de um token
 * do sistema as tornaria erradas. A visão geral é nossa, e usa `--primary`.
 */
const tabsConfig: Record<TabKey, { label: string; icon: LucideIcon; color: string; bg: string; h1: string; sub: string }> = {
  visao:  { label: "Visão geral", icon: LayoutGrid, color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 10%)", h1: "Marketing", sub: "Performance consolidada de todas as fontes de tráfego" },
  meta:   { label: "Meta Ads",    icon: Facebook,   color: "var(--vx-meta)",      bg: "var(--vx-meta-bg)",         h1: "Meta Ads",  sub: "Facebook · Instagram · Reels" },
  google: { label: "Google Ads",  icon: Chrome,     color: "var(--vx-google)",    bg: "var(--vx-google-bg)",       h1: "Google Ads", sub: "Search · Display · YouTube" },
};

// ────────────── Componente raiz ──────────────

export default function MarketingOverview() {
  const [tab, setTab] = useState<TabKey>("visao");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customDays, setCustomDays] = useState(14);
  const cfg = tabsConfig[tab];

  const data = useMarketingData(period, customDays);
  const days = periodDays(period, customDays);

  return (
    <PageShell
      title={cfg.h1}
      description={cfg.sub}
      meta={
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full bg-primary", data.loading && "vx-pulse-dot")} aria-hidden />
          Atualizado às {formatarHora(data.updatedAt)}
        </p>
      }
      actions={<>
        <PeriodFilter value={period} onChange={setPeriod} customDays={customDays} onCustomChange={setCustomDays} />
        {/* O selo só aparece quando o dado chegou: "Dados reais" em cima de
            uma consulta que falhou seria afirmar o que a tela não tem. */}
        {!data.error && !data.loading && <SourceBadge source="real" />}
        {/* Era "Sincronizar", e não fazia nada -- o botão não tinha ação. O
            que ele pode fazer de verdade é buscar de novo o que já foi
            sincronizado, e o rótulo diz isso. */}
        <Button variant="outline" size="sm" onClick={data.refetch} disabled={data.loading}>
          <RefreshCw aria-hidden className={data.loading ? "animate-spin" : undefined} />Atualizar
        </Button>
      </>}
    >
      <TabBar tab={tab} onChange={setTab} />

      {/* Erro antes de vazio: uma consulta que falhou devolve listas vazias, e
          "sem dados" nesse caso afirmaria um fato que a tela não conhece. */}
      {data.error ? (
        <ErrorState
          titulo="Não foi possível carregar os dados de marketing"
          descricao={data.error}
          onTentarNovamente={data.refetch}
        />
      ) : data.loading && data.meta.campaigns.length === 0 ? (
        <LoadingState linhas={4} />
      ) : (
        <div key={`${tab}-${period}-${customDays}`} className="vx-fade-up">
          {tab === "visao"  && <PanelVisao data={data} days={days} onVerCanal={setTab} />}
          {tab === "meta"   && <PanelMeta  data={data} days={days} />}
          {tab === "google" && <PanelGoogle data={data} days={days} />}
        </div>
      )}
    </PageShell>
  );
}

// ────────────── Period filter ──────────────

/**
 * O seletor de período.
 *
 * Era a SEXTA cópia do grupo de pílulas, e tinha o teal CRAVADO como
 * `var(--vx-teal)` no fundo do item ativo -- mesmo defeito que a barra lateral
 * tinha: a cor de destaque é trocável em tempo de execução, e escolher roxo
 * deixava o período selecionado teal.
 *
 * "Custom" também era a única palavra em inglês da tela.
 */
function PeriodFilter({ value, onChange, customDays, onCustomChange }: {
  value: PeriodKey;
  onChange: (k: PeriodKey) => void;
  customDays: number;
  onCustomChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <SegmentedControl<PeriodKey>
        rotuloGrupo="Período"
        valor={value}
        onChange={onChange}
        compactoNoCelular={false}
        opcoes={[
          { valor: "7d", rotulo: "7 dias" },
          { valor: "30d", rotulo: "30 dias" },
          { valor: "90d", rotulo: "90 dias" },
          { valor: "custom", rotulo: "Escolher", icone: Calendar },
        ]}
      />
      {value === "custom" && (
        <div className="inline-flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            max={365}
            value={customDays}
            onChange={(e) => onCustomChange(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
            aria-label="Número de dias do período"
            className="h-8 w-16 text-center text-xs tabular-nums"
          />
          <span className="text-xs text-muted-foreground">dias</span>
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source: _source }: { source: MarketingSource }) {
  return (
    <Badge variant="success" className="h-8 gap-1.5 px-2.5 text-xs" title="Dados sincronizados das plataformas">
      <Database aria-hidden className="h-3 w-3" />
      Dados reais
    </Badge>
  );
}

// ────────────── Tab bar ──────────────

/**
 * A barra de abas do Marketing.
 *
 * Era a SÉTIMA cópia deste controle no projeto, e a única que não usava nem
 * `PageTabs` nem `SegmentedControl` -- botões com estilo em linha, incluindo a
 * sombra e a borda escritas à mão.
 *
 * A cor por aba (azul do Meta, vermelho do Google) é o motivo de ela existir, e
 * agora é uma opção do primitivo em vez de uma cópia inteira.
 */
function TabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <SegmentedControl<TabKey>
      rotuloGrupo="Fonte de tráfego"
      valor={tab}
      onChange={onChange}
      compactoNoCelular={false}
      opcoes={(Object.keys(tabsConfig) as TabKey[]).map((k) => ({
        valor: k,
        rotulo: tabsConfig[k].label,
        icone: tabsConfig[k].icon,
        corAtiva: tabsConfig[k].color,
      }))}
    />
  );
}

// ────────────── Empty state ──────────────

/**
 * Era o décimo terceiro formato de estado vazio do projeto: ícone num anel,
 * título, descrição -- exatamente o que `EmptyState` faz, escrito de novo com
 * medidas próprias.
 */
function MarketingEmptyState({
  platform,
  /**
   * `nao-integrado` não é "sem dados no período".
   *
   * O Google Ads dizia "Conecte sua conta Google Ads" e oferecia um botão para
   * Integrações -- onde não existe integração de Google Ads para conectar. A
   * tela mandava a pessoa procurar uma coisa que não está lá.
   */
  integrado = true,
}: {
  platform: string;
  integrado?: boolean;
}) {
  if (!integrado) {
    return (
      <EmptyState
        icone={PlugZap}
        titulo={`${platform} ainda não integrado`}
        descricao={`A sincronização com ${platform} não foi construída. Não é ausência de campanha no período — é ausência da integração.`}
      />
    );
  }
  return (
    <EmptyState
      icone={PlugZap}
      titulo={`Sem dados de ${platform}`}
      descricao={`Conecte sua conta ${platform} para ver as campanhas aqui.`}
      acao={
        <Button asChild size="sm" variant="outline">
          <a href="/settings/integrations">Ir para Integrações</a>
        </Button>
      }
    />
  );
}

// ────────────── PANEL: VISÃO GERAL ──────────────

type PanelProps = { data: ReturnType<typeof useMarketingData>; days: number };

function PanelVisao({ data, days, onVerCanal }: PanelProps & { onVerCanal: (t: TabKey) => void }) {
  const metaCamps = data.meta.campaigns;
  const googleCamps = data.google.campaigns;
  const hasData = metaCamps.length > 0 || googleCamps.length > 0;

  const totalMeta = sumBy(metaCamps, "investido");
  const totalGoogle = sumBy(googleCamps, "investido");
  const totalInv = totalMeta + totalGoogle;
  const totalRev = sumBy(metaCamps, "receita_atrib") + sumBy(googleCamps, "receita_atrib");
  const totalLeads = sumBy(metaCamps, "conversoes") + sumBy(googleCamps, "conversoes");
  const cplMedio = totalLeads > 0 ? totalInv / totalLeads : 0;
  const totalImp = sumBy(metaCamps, "impressoes") + sumBy(googleCamps, "impressoes");
  const totalClicks = sumBy(metaCamps, "cliques") + sumBy(googleCamps, "cliques");
  const ctrAvg = totalImp ? (totalClicks / totalImp) * 100 : 0;
  const cvrAvg = totalClicks ? (totalLeads / totalClicks) * 100 : 0;
  // O Meta não atribui receita (ver useMarketingData): só o Google traz
  // `conversions_value`. Sem Google, receita zero é "ninguém mediu", não
  // "não vendeu".
  const receitaMedida = data.google.source === "real" && totalRev > 0;

  if (!hasData) {
    return <MarketingEmptyState platform="Meta Ads ou Google Ads" />;
  }

  /**
   * Série diária REAL do período.
   *
   * A linha do Google era `Google: 0` CRAVADO — o gráfico desenhava uma reta no
   * zero e a tela dizia, sem dizer, que o Google não gastou nada. Agora vem do
   * hook, por plataforma. Os valores já estão em reais: a divisão dos micros do
   * Google acontece na edge function.
   */
  const series = data.daily.map((d) => ({ day: d.day, Meta: d.spendMeta, Google: d.spendGoogle }));
  const leadSources = data.sources;

  return (
    <div className="space-y-4">
      <FaixaDeIndicadores className="vx-stagger">
        <Indicador rotulo="Total investido" valor={fmtBRL(totalInv)} apoio={`Meta ${fmtBRL(totalMeta)} · Google ${fmtBRL(totalGoogle)}`} />
        <Indicador rotulo="Receita atribuída" valor={receitaMedida ? fmtBRL(totalRev) : "—"} apoio={receitaMedida ? `últimos ${days} dias` : "nenhuma fonte atribui receita"} />
        <Indicador rotulo="ROAS consolidado" valor={receitaMedida && totalInv > 0 ? `${decimal(totalRev / totalInv, 2)}×` : "—"} apoio="receita ÷ investido" />
        <Indicador rotulo="Leads totais" valor={fmtNum(totalLeads)} apoio={`CPL médio ${fmtBRL(cplMedio)}`} />
      </FaixaDeIndicadores>

      <FaixaDeIndicadores>
        <Indicador rotulo="Impressões" valor={compacto(totalImp)} apoio="nas duas plataformas" />
        <Indicador rotulo="CTR médio" valor={porcento(ctrAvg)} apoio="cliques ÷ impressões" />
        <Indicador rotulo="Taxa de conversão" valor={porcento(cvrAvg)} apoio="leads ÷ cliques" />
      </FaixaDeIndicadores>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Bloco
          titulo="Performance dos canais"
          descricao={`Investimento diário Meta vs Google · últimos ${days} dias`}
        >
          <AreaSeries
            altura={240}
            formatar={fmtBRL}
            rotulos={series.map((d) => d.day)}
            series={[
              { nome: "Meta Ads", cor: "var(--vx-meta)", pontos: series.map((d) => d.Meta), preencher: true },
              { nome: "Google Ads", cor: "var(--vx-google)", pontos: series.map((d) => d.Google), preencher: true },
            ]}
          />
        </Bloco>

        <Bloco titulo="Origem dos leads" descricao="Distribuição por canal">
          {/* A rosca e a lista de canais eram dois blocos separados, com a
              legenda montada à mão logo abaixo do gráfico. `RoscaComLegenda`
              já é o par -- e mostra o percentual, que a lista não mostrava. */}
          {leadSources.length > 0 ? (
            <RoscaComLegenda
              tamanho={140}
              fatias={leadSources.map((f) => ({ nome: f.name, valor: f.count, cor: f.color }))}
            />
          ) : (
            <Vazio>Nenhum lead no período selecionado.</Vazio>
          )}
        </Bloco>

        <FunnelCard stages={data.funnel} />

        <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-1">
          <ChannelMiniCard color="var(--vx-meta)"   bg="var(--vx-meta-bg)"   icon={Facebook} name="Meta Ads"    sub="Facebook · Instagram · Reels"
            activeCount={metaCamps.filter(c => c.status === "ativo").length}
            onDetalhes={() => onVerCanal("meta")}
            metrics={[
              { label: "Investido", value: fmtBRL(totalMeta) },
              { label: "Leads", value: fmtNum(sumBy(metaCamps, "conversoes")) },
              { label: "CTR", value: porcento(metaCamps.length ? (sumBy(metaCamps, "cliques") / Math.max(1, sumBy(metaCamps, "impressoes"))) * 100 : 0) },
              { label: "CPC", value: fmtBRL(metaCamps.length ? sumBy(metaCamps, "investido") / Math.max(1, sumBy(metaCamps, "cliques")) : 0) },
            ]}
            bars={metaCamps.map(c => ({ label: c.nome, value: c.conversoes }))}
          />
          <ChannelMiniCard color="var(--vx-google)" bg="var(--vx-google-bg)" icon={Chrome}   name="Google Ads"  sub="Search · Display · YouTube"
            activeCount={googleCamps.filter(c => c.status === "ativo").length}
            integrado={data.google.source === "real"}
            onDetalhes={() => onVerCanal("google")}
            metrics={[
              { label: "Investido", value: fmtBRL(totalGoogle) },
              { label: "Leads", value: fmtNum(sumBy(googleCamps, "conversoes")) },
              { label: "CTR", value: porcento(googleCamps.length ? (sumBy(googleCamps, "cliques") / Math.max(1, sumBy(googleCamps, "impressoes"))) * 100 : 0) },
              { label: "CPC", value: fmtBRL(googleCamps.length ? sumBy(googleCamps, "investido") / Math.max(1, sumBy(googleCamps, "cliques")) : 0) },
            ]}
            bars={googleCamps.map(c => ({ label: c.nome, value: c.conversoes }))}
          />
        </div>
      </div>
    </div>
  );
}

// ────────────── PANEL: META ──────────────

function PanelMeta({ data, days }: PanelProps) {
  const rows = data.meta.campaigns;

  if (rows.length === 0) {
    return <MarketingEmptyState platform="Meta Ads" />;
  }

  const inv = sumBy(rows, "investido");
  const imp = sumBy(rows, "impressoes");
  const clicks = sumBy(rows, "cliques");
  const conv = sumBy(rows, "conversoes");
  const reach = sumBy(rows, "alcance");
  const cpc = clicks ? inv / clicks : 0;
  const cpm = imp ? (inv / imp) * 1000 : 0;
  const freq = reach ? imp / reach : 0;
  const cpl = conv ? inv / conv : 0;

  // Série diária REAL vinda do meta_insights (antes era uma curva sintética)
  const trend = data.daily.map((d) => ({ day: d.day, Investido: d.spend, Leads: d.conversions }));

  const sorted = [...rows].sort((a, b) => b.conversoes - a.conversoes).slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Duas faixas de quatro, não uma de oito: com oito colunas o valor em
          reais não cabe na célula e quebra no meio do número. */}
      <FaixaDeIndicadores>
        <Indicador rotulo="Investido" valor={fmtBRL(inv)} apoio={`últimos ${days} dias`} />
        {/* O Meta não devolve receita atribuída: o hook grava 0 até a
            conversão do funil ser integrada. "—" diz isso; R$ 0 mentiria. */}
        <Indicador rotulo="Receita" valor="—" apoio="sem atribuição de receita" />
        <Indicador rotulo="Leads" valor={fmtNum(conv)} apoio={`CPL ${fmtBRL(cpl)}`} />
        <Indicador rotulo="Cliques" valor={compacto(clicks)} apoio={`CPC ${fmtBRL(cpc)}`} />
      </FaixaDeIndicadores>
      <FaixaDeIndicadores>
        <Indicador rotulo="Impressões" valor={compacto(imp)} apoio={`CPM ${fmtBRL(cpm)}`} />
        <Indicador rotulo="Alcance" valor={compacto(reach)} apoio="pessoas únicas" />
        <Indicador rotulo="Frequência" valor={decimal(freq, 1)} apoio="impressões por pessoa" tom={freq > 3.5 ? "atencao" : undefined} />
      </FaixaDeIndicadores>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Bloco titulo="Tendência diária" descricao={`Investimento e leads · últimos ${days} dias`}>
          {/* Dois eixos: investimento em reais à esquerda, leads à direita.
              Numa escala comum a contagem viraria uma linha colada no zero. */}
          <AreaSeries
            altura={240}
            formatar={fmtBRL}
            rotulos={trend.map((d) => d.day)}
            series={[
              { nome: "Investido", cor: "var(--vx-meta)", pontos: trend.map((d) => d.Investido), preencher: true },
              { nome: "Leads", cor: "var(--vx-purple)", pontos: trend.map((d) => d.Leads), eixoDireito: true },
            ]}
          />
        </Bloco>

        <Bloco titulo="Ranking de campanhas" descricao="Por leads gerados">
          <BarrasAgrupadas
            linhas={sorted}
            rotulo={(c) => c.nome}
            formatar={formatarNumero}
            vazio="Nenhuma campanha com leads no período"
            series={[{ nome: "Leads", cor: "var(--vx-meta)", valor: (c) => c.conversoes }]}
          />
        </Bloco>
      </div>

      <CampaignTable rows={rows} platform="meta" />

      <div className="grid gap-4 lg:grid-cols-3">
        <PendingDataCard title="CPL por público" sub="Quanto menor, melhor" requirement="Requer sincronização de conjuntos de anúncios (ad sets) do Meta — ainda não integrada." />
        <PendingDataCard title="Top criativos" sub="Ordenado por CTR" requirement="Requer sincronização de anúncios individuais (ads) do Meta — ainda não integrada." />
        <PendingDataCard title="Demografia" sub="% leads por faixa etária" requirement="Requer insights demográficos do Meta — ainda não integrados." />
      </div>
    </div>
  );
}

// ────────────── PANEL: GOOGLE ──────────────

function PanelGoogle({ data, days }: PanelProps) {
  const rows = data.google.campaigns;

  if (rows.length === 0) {
    return <MarketingEmptyState platform="Google Ads" integrado={false} />;
  }

  const inv = sumBy(rows, "investido");
  const rev = sumBy(rows, "receita_atrib");
  const imp = sumBy(rows, "impressoes");
  const clicks = sumBy(rows, "cliques");
  const conv = sumBy(rows, "conversoes");
  const cpc = clicks ? inv / clicks : 0;
  const qsAvg = rows.length ? rows.reduce((s, r) => s + (r.quality_score || 0), 0) / rows.length : 0;
  const isAvg = rows.length ? rows.reduce((s, r) => s + (r.impression_share || 0), 0) / rows.length : 0;

  // Google Ads ainda não tem sincronização de insights — séries zeradas honestas
  const trend = data.daily.map((d) => ({ day: d.day, Investido: 0, Conversões: 0 }));
  const ctrSeries = data.daily.map((d) => ({ day: d.day, CTR: 0, CPC: 0 }));
  const sorted = [...rows].sort((a, b) => b.conversoes - a.conversoes).slice(0, 6);

  return (
    <div className="space-y-4">
      <FaixaDeIndicadores>
        <Indicador rotulo="Investido" valor={fmtBRL(inv)} apoio={`últimos ${days} dias`} />
        <Indicador rotulo="Receita" valor={fmtBRL(rev)} apoio={inv > 0 ? `ROAS ${decimal(rev / inv, 2)}×` : undefined} />
        <Indicador rotulo="Conversões" valor={fmtNum(conv)} apoio={`CPC médio ${fmtBRL(cpc)}`} />
        <Indicador rotulo="Cliques" valor={compacto(clicks)} apoio={`de ${compacto(imp)} impressões`} />
      </FaixaDeIndicadores>
      <FaixaDeIndicadores>
        <Indicador rotulo="Parcela de impressões" valor={porcento(isAvg)} apoio="média das campanhas" />
        <Indicador rotulo="Índice de qualidade" valor={`${decimal(qsAvg, 1)}/10`} apoio="média das campanhas" />
      </FaixaDeIndicadores>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Bloco titulo="Tendência diária" descricao={`Investimento e conversões · últimos ${days} dias`}>
          {/* Dois eixos: investimento em reais à esquerda, conversões à
              direita. Numa escala comum a contagem viraria uma linha colada
              no zero. */}
          <AreaSeries
            altura={240}
            formatar={fmtBRL}
            rotulos={trend.map((d) => d.day)}
            series={[
              { nome: "Investido", cor: "var(--vx-google)", pontos: trend.map((d) => d.Investido), preencher: true },
              { nome: "Conversões", cor: "var(--vx-purple)", pontos: trend.map((d) => d["Conversões"]), eixoDireito: true },
            ]}
          />
        </Bloco>

        <Bloco titulo="CTR vs CPC" descricao="Eficiência por dia">
          {/* Linha é área sem preenchimento -- o mesmo primitivo. CTR em
              porcento à esquerda, CPC em reais à direita: grandezas que não
              se comparam. */}
          <AreaSeries
            altura={240}
            formatar={(v) => `${v}`}
            rotulos={ctrSeries.map((d) => d.day)}
            series={[
              { nome: "CTR (%)", cor: "hsl(var(--primary))", pontos: ctrSeries.map((d) => d.CTR) },
              { nome: "CPC (R$)", cor: "hsl(var(--warning))", pontos: ctrSeries.map((d) => d.CPC), eixoDireito: true },
            ]}
          />
        </Bloco>
      </div>

      <Bloco titulo="Ranking de campanhas" descricao="Por conversões">
        <BarrasAgrupadas
          linhas={sorted}
          rotulo={(c) => c.nome}
          formatar={formatarNumero}
          vazio="Nenhuma campanha com conversões no período"
          series={[{ nome: "Conversões", cor: "var(--vx-google)", valor: (c) => c.conversoes }]}
        />
      </Bloco>

      <CampaignTable rows={rows} platform="google" />

      <div className="grid gap-4 lg:grid-cols-3">
        <PendingDataCard title="Palavras-chave" sub="Performance Search" requirement="Requer integração com Google Ads — ainda não disponível." />
        <PendingDataCard title="Parcela de impressões" sub="Onde estou perdendo" requirement="Requer integração com Google Ads — ainda não disponível." />
        <PendingDataCard title="Índice de qualidade" sub="Saúde geral das campanhas" requirement="Requer integração com Google Ads — ainda não disponível." />
      </div>
    </div>
  );
}

// ────────────── Cartão de canal ──────────────

function ChannelMiniCard({ color, bg, icon: Icon, name, sub, activeCount, metrics, bars, onDetalhes, integrado = true }: {
  color: string;
  bg: string;
  icon: LucideIcon;
  name: string;
  sub: string;
  activeCount: number;
  metrics: { label: string; value: string }[];
  bars: { label: string; value: number }[];
  onDetalhes: () => void;
  /** Sem integração, os números são zeros de nada -- o cartão diz isso. */
  integrado?: boolean;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <Card className="min-w-0 vx-card-hover">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{ background: bg }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </span>
            <div className="min-w-0">
              <CardTitle>{name}</CardTitle>
              <CardDescription className="truncate">{sub}</CardDescription>
            </div>
          </div>
          {integrado
            ? <Badge variant="success" className="shrink-0">{activeCount} ativas</Badge>
            : <Badge variant="neutral" className="shrink-0">não integrado</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {!integrado ? (
          <p className="border-l-2 border-border pl-4 text-xs text-muted-foreground">
            A sincronização com {name} não foi construída: não há investimento nem leads para mostrar.
          </p>
        ) : (<>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{m.value}</dd>
            </div>
          ))}
        </dl>
        {bars.length > 0 && (
          <div className="mt-4 flex h-14 items-end gap-1 border-t border-border pt-3" aria-hidden>
            {bars.map((b, i) => (
              <div key={i} className="vx-grow-h flex-1 rounded-t-sm" style={{
                background: color,
                height: `${(b.value / max) * 100}%`,
                minHeight: 4,
                opacity: 0.85,
                animationDelay: `${i * 80}ms`,
              }} title={`${b.label}: ${b.value}`} />
            ))}
          </div>
        )}
        </>)}
        {/* "Detalhes" era um botão sem ação. Agora leva à aba do canal. */}
        <Button variant="ghost" size="sm" className="-ml-3 mt-2" onClick={onDetalhes}>
          Ver {name}<ArrowUpRight aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}

// ────────────── Funil ──────────────

/** A mesma escala de etapa do painel: da marca ao verde de venda. */
const COR_DA_ETAPA = ["var(--stage-1)", "var(--stage-2)", "var(--stage-3)", "var(--stage-4)", "var(--stage-5)", "var(--stage-6)"];

function FunnelCard({ stages }: { stages: FunnelStage[] }) {
  const parseN = (s: string) => {
    const n = parseFloat(s.replace(/[^\d.]/g, ""));
    return s.toLowerCase().includes("k") ? n * 1000 : n;
  };
  const maxNum = Math.max(1, ...stages.map((f) => parseN(f.num)));
  return (
    <Bloco titulo="Funil marketing → vendas" descricao="Conversão por etapa, com os dados reais do período">
      <ol className="space-y-3">
        {stages.map((f, i) => {
          const value = parseN(f.num);
          const pct = (value / maxNum) * 100;
          return (
            <li key={i}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{f.nome}</span>
                <span className="text-sm font-semibold tabular-nums">{f.num}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="vx-grow-w h-full rounded-full"
                  style={{ width: `${pct}%`, background: COR_DA_ETAPA[Math.min(i, COR_DA_ETAPA.length - 1)], animationDelay: `${i * 100}ms` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
            </li>
          );
        })}
      </ol>
    </Bloco>
  );
}

// ────────────── O que ainda não tem fonte ──────────────

/** Lugar honesto para métrica que exige sincronização ainda não integrada. */
function PendingDataCard({ title, sub, requirement }: { title: string; sub: string; requirement: string }) {
  return (
    <Bloco titulo={title} descricao={sub}>
      <div className="flex min-h-24 items-center gap-3 border-l-2 border-border pl-4 text-xs text-muted-foreground">
        <Database aria-hidden className="h-4 w-4 shrink-0" />
        <p className="max-w-[260px] leading-relaxed">{requirement}</p>
      </div>
    </Bloco>
  );
}

// ────────────── Tabela de campanhas ──────────────

const STATUS_DA_CAMPANHA: Record<Campaign["status"], { variante: "success" | "neutral" | "warning"; rotulo: string }> = {
  ativo: { variante: "success", rotulo: "Ativa" },
  pausado: { variante: "neutral", rotulo: "Pausada" },
  aprendendo: { variante: "warning", rotulo: "Aprendendo" },
};

/** Faixa boa / atenção / ruim, em token de estado (segue o tema escuro). */
const corPorFaixa = (v: number, bom: number, ok: number) =>
  v >= bom ? "text-success" : v >= ok ? "text-warning" : "text-destructive";

function CampaignTable({ rows, platform }: { rows: Campaign[]; platform: "meta" | "google" }) {
  const colunas = [
    "Campanha", "Status", "Investido", "Impressões",
    ...(platform === "meta" ? ["Alcance", "Freq.", "CPM"] : ["Parcela imp.", "Cliques"]),
    "CPC", "CTR",
    ...(platform === "meta" ? ["Leads"] : ["Conv.", "Taxa conv."]),
    "CPL", "ROAS",
    ...(platform === "meta" ? ["Receita"] : ["Índ. qual."]),
  ];
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>Campanhas</CardTitle>
        <CardDescription>{rows.length} no período</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="vx-table rounded-none border-x-0 border-b-0">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {colunas.map((h, i) => (
                  <th key={h} className={cn("whitespace-nowrap", i >= 2 ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = STATUS_DA_CAMPANHA[r.status];
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <div className="font-medium">{r.nome}</div>
                      <div className="text-muted-foreground">{r.tipo}</div>
                    </td>
                    <td>{status ? <Badge variant={status.variante}>{status.rotulo}</Badge> : r.status}</td>
                    <td className="text-right tabular-nums">{fmtBRL(r.investido)}</td>
                    <td className="text-right tabular-nums">{fmtNum(r.impressoes)}</td>
                    {platform === "meta" ? (
                      <>
                        <td className="text-right tabular-nums">{fmtNum(r.alcance)}</td>
                        <td className={cn("text-right tabular-nums", r.frequencia > 3.5 && "text-destructive")}>{decimal(r.frequencia, 2)}</td>
                        <td className="text-right tabular-nums">{formatarMoeda(r.cpm)}</td>
                      </>
                    ) : (
                      <>
                        <td className={cn("text-right tabular-nums", corPorFaixa(r.impression_share ?? 0, 80, 60))}>{porcento(r.impression_share ?? 0)}</td>
                        <td className="text-right tabular-nums">{fmtNum(r.cliques)}</td>
                      </>
                    )}
                    <td className="text-right tabular-nums">{formatarMoeda(r.cpc)}</td>
                    <td className={cn("text-right font-medium tabular-nums", corPorFaixa(r.ctr, 3, 1))}>{porcento(r.ctr)}</td>
                    {platform === "google" && <td className="text-right tabular-nums">{fmtNum(r.conversoes)}</td>}
                    {platform === "google" && <td className="text-right tabular-nums">{porcento(r.cvr)}</td>}
                    {platform === "meta" && <td className="text-right tabular-nums">{fmtNum(r.conversoes)}</td>}
                    <td className="text-right tabular-nums">{formatarMoeda(r.cpl)}</td>
                    {/* Sem receita atribuída (Meta), ROAS e receita não foram
                        medidos: "—", não 0,00× vermelho. */}
                    {platform === "meta" ? (
                      <>
                        <td className="text-right tabular-nums text-muted-foreground">—</td>
                        <td className="text-right tabular-nums text-muted-foreground">—</td>
                      </>
                    ) : (
                      <>
                        <td className={cn("text-right font-medium tabular-nums", corPorFaixa(r.roas, 3, 1))}>{decimal(r.roas, 2)}×</td>
                        <td className={cn("text-right font-medium tabular-nums", corPorFaixa(r.quality_score ?? 0, 7, 5))}>{r.quality_score}/10</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────── Helpers visuais ──────────────

function Bloco({ titulo, descricao, children, className }: { titulo: string; descricao?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-20 items-center border-l-2 border-border pl-4 text-xs text-muted-foreground">{children}</div>
  );
}

/** "12,4 mil" em vez de "12.4k": a tela é em português. */
function compacto(v: number): string {
  // Uma casa decimal pelo arredondamento, e a vírgula pelo formatador do projeto.
  if (v >= 1_000_000) return `${formatarNumero(Math.round(v / 100_000) / 10)} mi`;
  if (v >= 1_000) return `${formatarNumero(Math.round(v / 100) / 10)} mil`;
  return fmtNum(Math.round(v));
}

/** Vírgula decimal: `toFixed` escrevia "1.76" numa tela em português. */
function decimal(v: number, casas: number): string {
  const f = 10 ** casas;
  return formatarNumero(Math.round(v * f) / f);
}

function porcento(v: number): string {
  return `${decimal(v, 2)}%`;
}
