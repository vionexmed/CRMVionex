import { useState } from "react";
import { Copy, Check, Mail, Pencil, ExternalLink, Loader2, Eye } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import { formatarMoeda, formatarData, formatarDataHora, formatarTempoRelativo } from "@/lib/formato";
import { nomeDoContato } from "@/lib/contato-formato";
import { totaisDoOrcamento, type OrcamentoComRelacoes } from "@/lib/api/orcamentos";
import { SeloDeOrcamento } from "@/components/orcamentos/SeloDeOrcamento";
import { Iniciais } from "@/components/layout/ListaV1";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useMembers } from "@/hooks/queries/useMembers";
import { clienteDoOrcamento, codigoDoOrcamento } from "@/lib/orcamento-resumo";
import { estadoDoOrcamento } from "@/lib/orcamento-calculo";
import { useAtualizarOrcamento } from "@/hooks/queries/useOrcamentos";
import { useUpdateDeal } from "@/hooks/queries/useDeals";
import { EmailComposeModal } from "@/components/crm/EmailComposeModal";
import { useDeals } from "@/hooks/queries/useDeals";

/** O link que o cliente abre. Montado do `window.location`, para funcionar em
 *  produção, em prévia da Vercel e em desenvolvimento sem configuração. */
const linkPublico = (token: string) => `${window.location.origin}/o/${token}`;

/**
 * O orçamento por dentro, em dois lugares com o MESMO conteúdo.
 *
 * Em tela larga ele fica ao lado da lista (`PreviaDeOrcamento`), como a prévia
 * da proposta do V1; abaixo disso abre na gaveta de 520px do perfil de contato
 * (`PainelDeOrcamento`) -- "detalhe de uma coisa" já tem um gesto neste CRM.
 * Um só corpo, para as duas versões não divergirem em ação ou aviso.
 */
export function PainelDeOrcamento({
  orcamento,
  aoFechar,
  aoEditar,
}: {
  orcamento: OrcamentoComRelacoes | null;
  aoFechar: () => void;
  aoEditar: (o: OrcamentoComRelacoes) => void;
}) {
  if (!orcamento) return null;
  return (
    <Sheet open={!!orcamento} onOpenChange={(o) => !o && aoFechar()}>
      <SheetContent className="flex w-[520px] flex-col gap-0 p-0 sm:max-w-[520px]">
        <CorpoDoOrcamento orcamento={orcamento} aoEditar={aoEditar} emGaveta />
      </SheetContent>
    </Sheet>
  );
}

/** A prévia fixa ao lado da lista (xl). Sem fechar: trocar a linha troca a prévia. */
export function PreviaDeOrcamento({
  orcamento,
  aoEditar,
}: {
  orcamento: OrcamentoComRelacoes;
  aoEditar: (o: OrcamentoComRelacoes) => void;
}) {
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <CorpoDoOrcamento orcamento={orcamento} aoEditar={aoEditar} />
    </Card>
  );
}

function CorpoDoOrcamento({
  orcamento,
  aoEditar,
  emGaveta = false,
}: {
  orcamento: OrcamentoComRelacoes;
  aoEditar: (o: OrcamentoComRelacoes) => void;
  emGaveta?: boolean;
}) {
  const { toast } = useToast();
  const atualizar = useAtualizarOrcamento();
  const atualizarNegocio = useUpdateDeal();
  const { data: negocios } = useDeals();
  const { data: membros = [] } = useMembers();

  const [copiado, setCopiado] = useState(false);
  const [compondo, setCompondo] = useState(false);

  const itens = (orcamento.itens ?? []).map((i) => ({
    preco_unit: Number(i.preco_unit),
    quantidade: Number(i.quantidade),
    desconto: Number(i.desconto),
  }));
  const totais = totaisDoOrcamento(itens, Number(orcamento.desconto) || 0);

  const { nome: cliente } = clienteDoOrcamento(orcamento);
  const pessoa = orcamento.contact
    ? nomeDoContato(orcamento.contact.first_name, orcamento.contact.last_name)
    : "Sem contato";
  const link = linkPublico(orcamento.token);
  const estado = estadoDoOrcamento(orcamento);
  const aprovado = orcamento.status === "aprovado";
  // O responsável se resolve no cliente: `owner_id` aponta para auth.users e o
  // PostgREST não atravessa (ver CLAUDE.md).
  const dono = membros.find((m) => m.id === orcamento.owner_id)?.name ?? null;

  /*
    O negócio vinculado e o quanto ele diverge.

    `deals` vem do cache que a tela de Negócios já carrega -- não é consulta
    nova. Se o orçamento não tem negócio, não há o que sugerir.
  */
  const negocio = orcamento.deal_id
    ? (negocios?.data ?? []).find((d) => d.id === orcamento.deal_id)
    : null;
  const valorDoNegocio = negocio ? Number(negocio.value) || 0 : null;
  const divergeDoNegocio =
    aprovado && valorDoNegocio !== null && Math.abs(valorDoNegocio - totais.total) > 0.01;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: "Não consegui copiar", description: link, variant: "destructive" });
    }
  };

  /**
   * Marca como enviado.
   *
   * NÃO grava atividade própria: quem envia usa o compositor, e ele já registra
   * o e-mail. Uma segunda linha contaria o mesmo ato duas vezes -- e e-mail
   * conta como abordagem no painel, o que dobraria a métrica.
   */
  const marcarEnviado = async () => {
    try {
      await atualizar.mutateAsync({
        id: orcamento.id,
        patch: { status: "enviado", enviado_em: new Date().toISOString() },
      });
    } catch (e: unknown) {
      toast({ title: "Não foi possível marcar como enviado", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const sincronizarValor = async () => {
    if (!negocio) return;
    try {
      await atualizarNegocio.mutateAsync({ id: negocio.id, deal: { value: totais.total } });
      toast({ title: "Valor do negócio atualizado", description: formatarMoeda(totais.total, orcamento.moeda) });
    } catch (e: unknown) {
      toast({ title: "Não foi possível atualizar o negócio", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const codigo = codigoDoOrcamento(orcamento.numero);

  return (
    <>
      <div className="shrink-0 border-b border-border p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {emGaveta ? (
              <SheetTitle className="truncate font-mono text-base font-semibold">{codigo}</SheetTitle>
            ) : (
              <h2 className="vx-titulo-painel truncate font-mono">{codigo}</h2>
            )}
            <p className="vx-subtitulo mt-0.5 flex items-center gap-1.5">
              {orcamento.visto_em ? (
                <>
                  <Eye aria-hidden="true" className="h-3.5 w-3.5 text-info" />
                  Visualizado {formatarTempoRelativo(orcamento.visto_em)}
                </>
              ) : (
                <SeloDeOrcamento orcamento={orcamento} />
              )}
            </p>
          </div>
          {dono && <span title={dono} className={cn("shrink-0", emGaveta && "mr-8")}><Iniciais nome={dono} destaque /></span>}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* ── A proposta, como o cliente a lê ── */}
        <section className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="rounded-md bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">V</span>
                <span className="text-sm font-semibold">Vionex</span>
              </span>
              {orcamento.valido_ate && (
                <span className={cn("text-xs", estado === "expirado" ? "font-semibold text-warning" : "text-muted-foreground")}>
                  válido até {formatarData(orcamento.valido_ate)}
                </span>
              )}
            </div>

            <h3 className="vx-titulo-painel mt-4">Proposta comercial</h3>
            <p className="vx-subtitulo mt-0.5">
              Para {cliente}{cliente !== pessoa && orcamento.contact ? ` · ${pessoa}` : ""}
            </p>

            <ul className="mt-3 divide-y divide-border">
              {(orcamento.itens ?? []).map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.nome}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {Number(i.quantidade)} {i.unidade} × {formatarMoeda(Number(i.preco_unit), orcamento.moeda)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatarMoeda(
                      Math.max(0, Number(i.preco_unit) * Number(i.quantidade) - Number(i.desconto)),
                      orcamento.moeda,
                    )}
                  </p>
                </li>
              ))}
            </ul>

            <div className="space-y-1.5 border-t border-border pt-3 text-sm">
              {totais.desconto > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatarMoeda(totais.subtotal, orcamento.moeda)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="font-medium tabular-nums text-success">
                      − {formatarMoeda(totais.desconto, orcamento.moeda)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold tabular-nums">
                  {formatarMoeda(totais.total, orcamento.moeda)}
                </span>
              </div>
            </div>

            {orcamento.status === "rascunho" ? (
              <Button className="mt-4 w-full" onClick={marcarEnviado} disabled={atualizar.isPending}>
                {atualizar.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Marcar como enviado
              </Button>
            ) : (
              <Button className="mt-4 w-full" onClick={copiar}>
                {copiado ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {copiado ? "Link copiado" : "Copiar link da proposta"}
              </Button>
            )}
          </div>
        </section>

        {/* ── O link do cliente ── */}
        <section className="space-y-2">
          <p className="break-all rounded-md bg-muted/50 p-2 text-xs tabular-nums text-muted-foreground">{link}</p>
          <div className="flex flex-wrap gap-2">
            {orcamento.status === "rascunho" && (
              <Button variant="outline" size="sm" onClick={copiar}>
                {copiado ? <Check className="mr-1 h-3.5 w-3.5 text-success" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            )}
            <Button variant="outline" size="sm"
              disabled={!orcamento.contact?.email}
              title={orcamento.contact?.email ? undefined : "O contato não tem e-mail"}
              onClick={() => setCompondo(true)}>
              <Mail className="mr-1 h-3.5 w-3.5" />Enviar por e-mail
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={link} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />Ver como cliente
              </a>
            </Button>
          </div>
        </section>

        {/* ── O ciclo ── */}
        <section className="space-y-1.5 text-xs">
          {[
            ["Criado", orcamento.created_at],
            ["Enviado", orcamento.enviado_em],
            ["Visto pelo cliente", orcamento.visto_em],
            [
              orcamento.status === "recusado" ? "Recusado" : "Aprovado",
              orcamento.decidido_em,
            ],
          ].map(([rotulo, quando]) =>
            quando ? (
              <div key={rotulo as string} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{rotulo}</span>
                <span className="tabular-nums">{formatarDataHora(quando as string)}</span>
              </div>
            ) : null,
          )}
          {orcamento.decidido_por && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Por</span>
              <span className="truncate font-medium">{orcamento.decidido_por}</span>
            </div>
          )}
          {orcamento.motivo_recusa && (
            <p className="mt-1 rounded-md bg-destructive-soft p-2 leading-relaxed text-destructive">
              “{orcamento.motivo_recusa}”
            </p>
          )}
        </section>

        {/* ── Sugerir atualizar o negócio ── */}
        {divergeDoNegocio && (
          /* SUGERE, não sobrescreve. `deals.value` pode ter sido ajustado à
             mão, e gravar sozinho apagaria a decisão de alguém sem avisar. */
          <section className="space-y-2 rounded-lg border border-primary/30 bg-accent p-3">
            <p className="text-xs leading-relaxed">
              O negócio está em <strong>{formatarMoeda(valorDoNegocio!, orcamento.moeda)}</strong> e
              este orçamento aprovado soma <strong>{formatarMoeda(totais.total, orcamento.moeda)}</strong>.
            </p>
            <Button size="sm" className="w-full" onClick={sincronizarValor}
              disabled={atualizarNegocio.isPending}>
              {atualizarNegocio.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Atualizar o negócio para {formatarMoeda(totais.total, orcamento.moeda)}
            </Button>
          </section>
        )}

        {orcamento.observacoes && (
          <section className="rounded-lg border border-border p-3">
            <p className="text-label font-semibold uppercase tracking-wide text-muted-foreground">
              Observação interna
            </p>
            <p className="mt-1 text-xs leading-relaxed">{orcamento.observacoes}</p>
            <p className="mt-1.5 text-label text-muted-foreground/70">
              Não aparece na página do cliente.
            </p>
          </section>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-4">
        {/* Editar só antes da decisão: mudar item de orçamento já aprovado
            faria o CRM discordar do que o cliente aprovou por escrito. */}
        <Button
          variant="outline" size="sm"
          disabled={!!orcamento.decidido_em}
          title={orcamento.decidido_em ? "O cliente já respondeu — não dá para alterar" : undefined}
          onClick={() => aoEditar(orcamento)}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />Editar
        </Button>
      </div>

      {/* O compositor já vincula ao contato e ao negócio, então o envio entra no
          histórico. O link vai no corpo. */}
      <EmailComposeModal
        open={compondo}
        onOpenChange={setCompondo}
        defaultTo={orcamento.contact?.email || ""}
        defaultContactId={orcamento.contact_id}
        defaultDealId={orcamento.deal_id ?? undefined}
        onSent={() => {
          setCompondo(false);
          if (orcamento.status === "rascunho") void marcarEnviado();
        }}
      />
    </>
  );
}
