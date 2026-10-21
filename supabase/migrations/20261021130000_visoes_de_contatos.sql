-- Visões de Contatos: "último contato" real e "sem resposta há N dias".
--
-- Aditiva: só cria índice e uma view; nada existente muda.
--
-- Por que uma VIEW e não uma coluna: o último contato é derivado de três
-- tabelas (atividades concluídas, mensagens de WhatsApp, e-mails enviados). Uma
-- coluna denormalizada precisaria de trigger nas três e envelheceria no primeiro
-- caminho que esquecesse de mantê-la. Na view, a lista ordena, filtra e pagina
-- no servidor com o PostgREST normal (count, order, range), sem baixar a base
-- para somar no navegador -- que esbarraria no corte silencioso de 1000 linhas.
--
-- ARMADILHA: `c.*` é expandido na CRIAÇÃO. Coluna adicionada a `contacts`
-- depois não aparece aqui até a view ser recriada (DROP + CREATE). A tela cai
-- para a tabela `contacts` se a view não existir, então a ordem de aplicação
-- entre frontend e banco não quebra nada.

-- "Última conclusão por contato" é o acesso quente da subconsulta lateral.
create index if not exists idx_activities_contato_concluida
  on public.activities (contact_id, completed_at desc)
  where completed_at is not null;

create index if not exists idx_whatsapp_messages_contato_data
  on public.whatsapp_messages (contact_id, created_at desc)
  where contact_id is not null;

create index if not exists idx_emails_contato_enviado
  on public.emails (contact_id, sent_at desc)
  where contact_id is not null and status = 'sent';

drop view if exists public.contatos_com_ultimo_contato;

-- security_invoker: a view roda com a RLS de quem consulta. Sem isso ela rodaria
-- como o dono e vazaria contatos de outras organizações.
create view public.contatos_com_ultimo_contato
with (security_invoker = true) as
select
  c.*,
  ult.ultimo_contato
from public.contacts c
left join lateral (
  select max(t.quando) as ultimo_contato
  from (
    select max(a.completed_at) as quando
      from public.activities a
     where a.contact_id = c.id and a.completed_at is not null
    union all
    select max(m.created_at)
      from public.whatsapp_messages m
     where m.contact_id = c.id
    union all
    select max(e.sent_at)
      from public.emails e
     where e.contact_id = c.id and e.status = 'sent'
  ) t
) ult on true;

grant select on public.contatos_com_ultimo_contato to authenticated;

comment on view public.contatos_com_ultimo_contato is
  'contacts + ultimo_contato (maior entre atividade concluída, mensagem de WhatsApp e e-mail enviado). "Sem resposta há N dias" = ultimo_contato < now() - N dias, filtrado pelo cliente.';
