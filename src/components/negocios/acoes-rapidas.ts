import { Calendar, Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import type { DealWithRelations } from "@/lib/api/deals";
import type { AcaoRapida } from "@/components/negocios/ResumoDoNegocio";

/*
 * Arquivo à parte de ResumoDoNegocio.tsx porque aqui só há função: arquivo de
 * componente que também exporta função quebra o fast refresh do Vite.
 */

/** Os tipos que as ações rápidas registram na página do negócio. */
export type TipoParaRegistrar = "note" | "call" | "task";

/**
 * Nota, E-mail, Ligar, WhatsApp, Tarefa -- ligados ao que já existe.
 *
 * - Nota, Ligar e Tarefa abrem o formulário de atividade do negócio com o tipo
 *   escolhido. "Ligar" REGISTRA a ligação: discar é do telefone, e o que o CRM
 *   precisa é que ela vire histórico (é o que conta como abordagem no painel).
 * - E-mail abre o compositor do CRM, amarrado ao contato e ao negócio.
 * - WhatsApp abre a conversa do contato em Comunicação -- o mesmo destino do
 *   "Abrir conversa" da ficha da pessoa.
 */
export function montarAcoesRapidas({ deal, registrar, escreverEmail }: {
  deal: DealWithRelations;
  registrar: (tipo: TipoParaRegistrar) => void;
  escreverEmail?: () => void;
}): AcaoRapida[] {
  const email = deal.contact?.email?.trim() || null;
  const telefone = deal.contact?.phone?.trim() || null;
  return [
    { chave: "nota", rotulo: "Nota", Icone: Pencil, titulo: "Registrar nota", onClick: () => registrar("note") },
    {
      chave: "email", rotulo: "E-mail", Icone: Mail,
      titulo: !email ? "Sem e-mail no contato" : !escreverEmail ? "Compositor indisponível aqui" : `Escrever para ${email}`,
      desabilitado: !email || !escreverEmail,
      onClick: escreverEmail,
    },
    { chave: "ligar", rotulo: "Ligar", Icone: Phone, titulo: "Registrar ligação", onClick: () => registrar("call") },
    {
      chave: "whatsapp", rotulo: "WhatsApp", Icone: MessageCircle,
      titulo: !deal.contact ? "Sem contato vinculado" : !telefone ? "Sem telefone no contato" : "Abrir conversa no WhatsApp",
      desabilitado: !deal.contact || !telefone,
      para: deal.contact ? `/atendimento?thread=${encodeURIComponent(`whatsapp:${deal.contact.id}`)}` : undefined,
    },
    { chave: "tarefa", rotulo: "Tarefa", Icone: Calendar, titulo: "Agendar tarefa", onClick: () => registrar("task") },
  ];
}
