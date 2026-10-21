# Vionex CRM — plano de implementação do redesenho completo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever a experiência visual de todas as páginas e tornar navegação, busca, comunicação e feedback de operações claros e confiáveis.

**Architecture:** Preservar React Router, Supabase, React Query e as permissões existentes. Uma fonte de navegação alimenta sidebar, mobile, breadcrumbs e busca; Comunicação possui shell e canais separados. Componentes de superfície, lista, detalhe e formulário definem a linguagem visual, enquanto cada página é recomposta conforme a matriz da especificação.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Radix, TanStack Query, Supabase, dnd-kit, Vitest/Testing Library. CSS e bibliotecas já instaladas para motion; nova dependência só após demonstrar necessidade.

**Spec:** `docs/superpowers/specs/2026-10-03-crm-redesign-design.md`.

## Estado inicial

Existem mudanças locais da primeira rodada e alterações prévias do usuário em `.claude-flow` e `docs/audit`. Não sobrescrever, limpar ou incluir essas alterações em commits do redesenho. A primeira rodada tem 1.381 testes passando; typecheck/build passando; lint dos arquivos alterados sem aumento. Não concluir que o redesenho completo já está executado.

## Global Constraints

- Seis destinos primários: Painel, Atividades, Clientes, Negócios, Comunicação, Análise.
- Comunicação reúne WhatsApp, Instagram e e-mail com consultas, permissões e rascunhos separados.
- Busca abaixo da logo no desktop; Cmd/Ctrl+K; acionador no cabeçalho mobile.
- Raio de 6 px para superfícies/overlays e 4 px para controles; seções contínuas sem sombra.
- Preservar ThemeContext, claro/escuro e cor personalizada; texto normal mínimo 4,5:1.
- Escala de espaço 4/8/12/16/24/32 px; targets mobile 44 px.
- `metadata.pais` e `metadata.cidade` são a fonte atual de localização; não inferir localização de telefone ou nome.
- Preservar aliases, fluxo OAuth, métricas SQL, lifecycle, RLS e confirmação de exclusão.
- `prefers-reduced-motion` elimina deslocamento/zoom/stagger/shimmer/pulso.
- Sem transform/filter/scale/backdrop em ancestrais do kanban; DragOverlay em document.body.
- Não testar envio/exclusão com dados reais; usar transporte controlado.
- Verificar todas as páginas da matriz; nenhuma rota é considerada concluída só por herdar CSS novo.

## Review Focus

1. Sessão muda enquanto perfil carrega: resposta antiga não pode abrir organização errada nem afirmar convite incompleto durante loading — tarefa 1.
2. Busca A lenta seguida de B rápida, termo com pontuação e storage indisponível: resultados atuais, navegação útil e erros recuperáveis — tarefa 4.
3. Seleção durante filtro debounced e exportação: critérios iguais e nenhuma ação sobre IDs obsoletos — tarefa 6.
4. Troca de canal/thread durante envio pendente: rascunho e erro retornam à conversa original — tarefa 5.
5. Kanban logo após navegação, teclado/reduced motion/mobile: arraste acompanha cursor e operações permanecem acessíveis — tarefas 7 e 13.

## Organização do trabalho

Executar 1→2→3→4. Tarefa 5 depende de 3 e 4; tarefas 6–12 dependem de 2 e 3. Motion da tarefa 13 é integrado a cada entrega, com revisão central ao final. Tarefa 14 só começa após todas as demais.

Os agentes podem trabalhar em páginas independentes depois de fixar os contratos compartilhados. A fundação e a navegação têm um proprietário por vez; não permitir edições concorrentes em `index.css`, `App.tsx`, `navegacao.ts` ou nos mesmos primitivos. Cada entrega funcional tem teste red→green e revisão independente. Entregas puramente visuais usam verificação renderizada e testes de regressão existentes, sem criar testes que apenas espelhem classes CSS.

## Task 1 — entrada e salvamento confiáveis

**Files:** modificar `src/contexts/AuthContext.tsx`, `src/components/layout/AppLayout.tsx`, `src/App.tsx`, `src/components/crm/ContactDrawer.tsx`, `src/hooks/queries/useDeals.ts`, `src/components/OfflineDetector.tsx`. Criar `src/test/auth/perfil-em-carregamento.test.tsx`, `src/test/crm/salvamento-confiavel.test.tsx`.

**Interfaces:** AuthContext expõe `profileStatus: 'idle' | 'loading' | 'ready' | 'missing' | 'error'`, `profileError: string | null`, `refreshProfile(): Promise<void>`; mantém `loading` compatível durante a migração. Cada carregamento recebe uma geração e só a geração vigente altera perfil/papel. Usar `mensagemErro(error)` para erros. INSERT de atividade só limpa formulário e confirma após sucesso.

- [ ] Escrever testes: login depois de deslogado mantém loading até perfil; cargas fora de ordem não sobrescrevem identidade; logout invalida carga; INSERT com erro mantém rascunho e não mostra sucesso; etapa com erro faz rollback e mostra mensagem.
- [ ] Rodar `npx vitest run src/test/auth/perfil-em-carregamento.test.tsx src/test/crm/salvamento-confiavel.test.tsx`; confirmar falhas no comportamento atual.
- [ ] Implementar estados/geração, retry recuperável, pending de save e feedback de rollback; texto offline descreve conectividade sem prometer fila.
- [ ] Rodar testes, `npm run typecheck`; verificar manualmente foco no erro e repetição de submit.
- [ ] Revisar diff e registrar entrega isolada em commit apenas dos arquivos desta tarefa, se execução ocorrer em branch autorizado.

## Task 2 — fundação visual e modelos de página

**Files:** modificar `src/index.css`, `tailwind.config.ts`, `src/components/ui/{card,button,input,tabs,dialog,sheet,table,badge}.tsx`, `src/components/layout/{PageShell,PageHeader,PageTabs,BarraDeAcoes,EstadoDaLista,SegmentedControl,Secao}.tsx`. Criar `src/components/layout/{WorkSurface,MetricStrip,SettingsRow,MasterDetailLayout,AuthLayout}.tsx`.

**Interfaces:** WorkSurface recebe children/className sem dados; MetricStrip recebe children e colunas responsivas; SettingsRow recebe label, description?, control; MasterDetailLayout recebe master/detail, selected:boolean, onBack e context?; AuthLayout recebe title, description?, children. Usar elementos semânticos, ReactNode e propriedades de apresentação; não consultar banco nesses componentes.

- [ ] Consolidar tokens com valores da spec; retirar gradientes/sombras de seções e pílulas de navegação; revisar raios explícitos em telas.
- [ ] Implementar padrões acima; Card mantém disponibilidade para registros individuais e não vira embalagem automática de cada seção.
- [ ] Ajustar abas para linha inferior; preserve seleção, foco e teclado Radix. Overlays têm cabeçalho/rolagem/ações e cabem na viewport.
- [ ] Renderizar lista, detalhe, formulário e analytics em claro/escuro; conferir contraste, foco, targets e espaços na escala.
- [ ] Rodar `npm run typecheck`, testes de primitivos existentes e build; atualizar somente expectativas estéticas deliberadamente superadas.
- [ ] Revisar e registrar entrega da fundação.

## Task 3 — sidebar limpa e arquitetura de navegação

**Files:** modificar `src/components/layout/{navegacao,AppSidebar,AppHeader,AppLayout,MobileBottomNav}.tsx` (navegacao é `.ts`), `src/App.tsx`; criar `src/components/layout/CommunicationLayout.tsx`, `src/test/navigation/estrutura-e-aliases.test.tsx`.

**Interfaces:** `NavSection` com `id`, `label`, `icon`, `entryPath`, `items: NavItem[]`; `NavItem` com `label`, `path`, `adminOnly?`, `aliases?: string[]`. Exportar `getVisibleNavigation(isAdmin:boolean): NavSection[]` e `getActiveSection(pathname:string): string | null`. Shell da aplicação mantém `onOpenSearch():void`, repassado à sidebar e ao header mobile.

- [ ] Testar seis destinos, membro/admin, deep links de negócio, aliases e alcance de todos os módulos no mobile.
- [ ] Executar teste para confirmar falha; migrar a fonte única e todos consumidores.
- [ ] Criar canais canônicos e aliases com parâmetros preservados. Manter `/settings/email` e RequireAdmin.
- [ ] Implementar sidebar 232/64 px, busca abaixo da logo e menu da conta; secondary nav dentro de cada área.
- [ ] Verificar back/forward, sidebar recolhida e mobile; `npx vitest run src/test/navigation/estrutura-e-aliases.test.tsx` e typecheck.
- [ ] Revisar e registrar entrega de navegação.

## Task 4 — busca que abre o registro escolhido

**Files:** modificar `src/components/CommandPalette.tsx`, `src/components/ui/command.tsx`, `src/pages/{Contacts,Companies}.tsx`, `src/lib/api/{contacts,companies}.ts`. Criar `src/lib/api/global-search.ts`, `src/hooks/queries/useGlobalSearch.ts`, `src/test/search/busca-global.test.tsx`.

**Interfaces:** `SearchResult = {id:string; kind:'contact'|'company'|'deal'; title:string; subtitle?:string; href:string}`; `searchEntities(orgId:string, term:string, signal?:AbortSignal): Promise<{contacts:SearchResult[];companies:SearchResult[];deals:SearchResult[];errors?:Partial<Record<'contacts'|'companies'|'deals',string>>}>`. `getById(orgId:string,id:string)` nas APIs de contatos/empresas, com escopo de organização. Histórico `vionex-search:<userId>:<orgId>` limitado a cinco termos.

- [ ] Testar A lenta/B rápida, falha de categoria, termo com pontuação, membro/admin, storage indisponível, contato fora da primeira página e registro inacessível.
- [ ] Rodar teste red; implementar debounce 300 ms, query key por identidade/termo, cancelamento/geração e estados por categoria.
- [ ] Derivar páginas do catálogo, remover Dashboard→login e duplicação; usar IDs e navegação real do resultado, sem filtragem dupla divergente.
- [ ] Implementar foco inicial, setas/Enter/Escape/retorno de foco e histórico isolado. Testar teclado com componentes reais.
- [ ] Rodar `npx vitest run src/test/search/busca-global.test.tsx`, typecheck e verificar browser por clique e Cmd/Ctrl+K.
- [ ] Revisar e registrar entrega da busca.

## Task 5 — Comunicação com canais independentes

**Files:** modificar `src/pages/{Conversations,Inbox,MyEmail,EmailTemplates,EmailSequences}.tsx`, `src/hooks/queries/useEmails.ts`, `src/lib/api/emails.ts`, CommunicationLayout. Criar `src/hooks/useConversationDrafts.ts`, `src/test/communication/canais-e-rascunhos.test.tsx`.

**Interfaces:** `ConversationKey = {orgId:string;channel:'whatsapp'|'instagram'|'email';identity:string;accountId?:string}`. `useConversationDrafts(key)` expõe draft/setDraft/clearDraft; persistência de texto é em memória por sessão, sem armazenar mensagens em storage global. `ChannelConnectionState` separa checking/connected/disconnected/error.

- [ ] Testar troca de canal com rascunho, envio falha após troca de thread e consulta pendente não mostra desconectado; membro não recebe CTA admin. Rascunhos em memória pertencem à sessão do usuário: logout/troca de identidade limpa ou isola o mapa, inclusive entre usuários da mesma organização; renovação da mesma sessão preserva o texto.
- [ ] Rodar red; integrar shell aos componentes sem alterar payloads/endpoints de envio.
- [ ] Implementar master/detail responsivo e status real; manter pastas, anexos e conta Gmail; Templates/Sequências permanecem admin.
- [ ] Paginar histórico sob o contrato atual das APIs; ordenar de forma estável, preservar viewport ao carregar mensagens antigas e indicar alcance da busca. Não prometer busca em todo histórico sem consulta correspondente.
- [ ] Rodar testes; verificar aliases, OAuth e estados com transporte controlado; nenhuma mensagem real enviada na validação.
- [ ] Revisar e registrar entrega de Comunicação.

## Task 6 — Clientes, filtros e fichas

**Files:** modificar `src/pages/{Contacts,Companies}.tsx`, `src/components/crm/{ContactDrawer,CompanyDrawer,ContactCreateModal,CompanyCreateModal,ContactsKanbanByOwner,CSVImportModal}.tsx`, `src/lib/api/contacts.ts`. Criar `src/test/contacts/filtros-selecao-exportacao.test.tsx`; ampliar `src/test/lib/api/contacts-localizacao.test.ts`.

**Interfaces:** separar `draftFilters` e `appliedCriteria = {search,filters,sortKey,sortDir,page}`. Tabela, kanban, contagem e exportação usam appliedCriteria. Aplicar filtro e página zero na mesma atualização; seleção vinculada à chave efetiva e IDs exibidos.

- [ ] Testar país+cidade+origem, clear, count, duas páginas, exportação em múltiplos blocos e seleção antiga durante debounce; caracteres especiais via transporte controlado e, para semântica ilike, fixture de banco local se disponível.
- [ ] Rodar red; implementar snapshot único e feedback Atualizando filtros; não exportar critérios diferentes das linhas exibidas.
- [ ] Recompôr lista e alternativas em células conectadas; drawers por seções sem cartões; todos overlays mobile usam largura dentro da viewport.
- [ ] Verificar rascunho em falha, duplo submit, criação e importação sem alterar lifecycle legado; fonte de localização permanece pais/cidade.
- [ ] Testes, typecheck e revisão visual de contato com muitos campos e sem dados.
- [ ] Revisar e registrar entrega de Clientes.

## Task 7 — Negócios, detalhe e atividades

**Files:** modificar `src/pages/{Deals,DealDetail,Activities}.tsx`, `src/components/crm/{DealsKanban,DealsList,DealsForecast}.tsx`, componentes de timeline/etapas usados por DealDetail. Criar `src/test/crm/kanban-interacao.test.tsx`.

**Interfaces:** layouts da tarefa 2; dados e mutations existentes; DragOverlay em portal document.body. Contexto de detalhe usa largura 320 px desktop e empilha abaixo de 1024 px.

- [ ] Testar rollback explicado, seleção em lote, abrir detalhe e sensor de teclado sem remover handlers existentes.
- [ ] Rodar red; implementar portal e feedback de destino; nenhum transform no ancestral.
- [ ] Recompôr detalhe em timeline/contexto e toolbar do funil; unificar lista/previsão. Atividades mobile usa agenda/lista legível.
- [ ] Verificar drag imediatamente após navegação, touch, scroll de coluna e colunas ganho/perda; movimento não aciona clique indevido.
- [ ] Rodar testes e typecheck; validar criar/editar em transporte controlado.
- [ ] Revisar e registrar entrega da operação comercial.

## Task 8 — painel, metas, relatórios e marketing

**Files:** modificar `src/pages/{Dashboard,SalesGoals,Reports}.tsx`, `src/pages/marketing/Overview.tsx`, `src/components/dashboard/{StatCard,SdrChartsPanel,SdrCharts}.tsx`, `src/components/reports/{SalesReport,ActivitiesReport,ContactsReport,ForecastReport,CustomReportBuilder}.tsx`.

**Interfaces:** MetricStrip/WorkSurface, hooks de métricas atuais; nenhuma alteração SQL por estética. Marketing.tsx continua Outlet/redirecionamento.

- [ ] Migrar indicadores para faixas e gráficos para áreas com divisórias; remover padding duplicado e raio explícito em Marketing.
- [ ] Preservar período e fontes; sem dado/sem fonte/falha/zero permanecem distintos. Assistente não simula disponibilidade.
- [ ] Verificar todas abas de relatórios e deep drilldown, labels longos, dados vazios e grandes; números não reanimam em refetch.
- [ ] Rodar testes de métricas/dashboard existentes, typecheck e build; comparar significado das contagens antes/depois.
- [ ] Revisar capturas e registrar entrega de análise visual.

## Task 9 — configuração, equipe e segurança

**Files:** modificar `src/pages/{Settings,Team,SecuritySettings,MyEmail}.tsx`, `src/components/settings/{GeneralTab,PipelinesTab,CustomFieldsTab,NotificationsTab,AppearanceTab,BillingTab,EmailSignatureTab,MinhaAssinatura,SessionsPanel}.tsx`.

**Interfaces:** SettingsRow e seções; APIs/permissões atuais. Editor/preview da assinatura compartilhado quando contrato já for equivalente; não fundir credenciais.

- [ ] Substituir cartão por configuração por linhas/seções; tabela de membros é a área principal, convite e pendentes são contextuais.
- [ ] Revisar funis, razões de perda, campos customizados, aparência, notificações, plano/faturas, assinatura e sessões.
- [ ] Conferir membro/admin, textos de limites e recursos indisponíveis; nenhum controle passa a conceder acesso por mudança visual.
- [ ] Rodar regressões de navegação/permissões/assinatura; typecheck; capturar claro/escuro e mobile.
- [ ] Revisar e registrar entrega de configuração.

## Task 10 — integrações e ferramentas administrativas

**Files:** modificar `src/pages/{Integrations,Automations,LeadScoring,EmailTemplates,EmailSequences}.tsx`, `src/components/integrations/{IntegrationsTab,WebhooksTab,ApiKeysTab,LeadCaptureTab,TrackingTab,ImportExportTab}.tsx`, builders existentes consumidos pelas páginas.

**Interfaces:** WorkSurface, SettingsRow, navegação secundária; contratos backend atuais.

- [ ] Catálogo de integrações mostra status real e ação contextual; separar erro ao verificar de desconectado.
- [ ] Automações em lista operacional; builder em sequência gatilho/condições/ações. Scoring usa regras/segmentos/tabela; templates usam lista e editor.
- [ ] Conferir todos estados de integrações e builders sem apresentar ações que não funcionam; manter masking de credenciais e permissões.
- [ ] Rodar regressões de integrações/credenciais e typecheck; verificar textos técnicos, foco e menus.
- [ ] Revisar e registrar entrega administrativa.

## Task 11 — produtos e orçamentos

**Files:** modificar `src/pages/{Produtos,Orcamentos,OrcamentoPublico}.tsx`, `src/components/produtos/{CartaoDeProduto,FormularioDeProduto}.tsx`, `src/components/orcamentos/{ConstrutorDeOrcamento,PainelDeOrcamento}.tsx` e itens/totais usados pelo construtor.

**Interfaces:** catálogo com células independentes; orçamento público é documento contínuo sem AppLayout. Manter cálculos e operações atuais.

- [ ] Recompôr catálogo/lista/editor; preços e totais alinhados, estado legível, ações coerentes.
- [ ] Orçamento público integra identificação/itens/condições/decisão; verificar pendente, aprovado, recusado, inválido e loading.
- [ ] Rodar testes existentes de orçamento/produto e typecheck; nenhum aceite real de orçamento na verificação.
- [ ] Verificar conteúdo longo, imagem ausente, mobile e botão de decisão sem obscurecer total.
- [ ] Revisar e registrar entrega comercial pública.

## Task 12 — autenticação e fluxos auxiliares

**Files:** modificar `src/pages/{Login,ResetPassword,AcceptInvite,NotFound}.tsx`, `src/components/onboarding/OnboardingModal.tsx` e passos consumidos; usar AuthLayout.

**Interfaces:** AuthLayout da tarefa 2; estado de perfil da tarefa 1; fluxos Supabase existentes.

- [ ] Unificar login/convite/reset; remover títulos e molduras redundantes; preservar links por e-mail/cadastro.
- [ ] Conferir foco, autocomplete, erro de campo, submit pending, texto de confirmação e contraste da marca.
- [ ] Verificar aliases de setup/404 e onboarding sem criar organização nova para compensar falha de perfil.
- [ ] Rodar regressões, typecheck e capturas. Não alterar senhas, aceitar convites ou disparar e-mails reais como teste.
- [ ] Revisar e registrar entrega de autenticação.

## Task 13 — motion e microinterações de toda a interface

**Files:** modificar `src/index.css`, `src/components/ui/{dialog,sheet,command}.tsx`, componentes layout e interações das tarefas anteriores. Criar teste comportamental de foco em `src/test/ux/foco-e-teclado.test.tsx`.

**Interfaces:** tokens `--motion-fast:120ms`, `--motion-state:160ms`, `--motion-overlay:200ms`, `--motion-sheet:240ms`, `--motion-ease:cubic-bezier(.2,.8,.2,1)`; saída drawer 180ms. Preferência reduced motion é tratada centralmente.

- [ ] Testar abertura/fechamento da busca com foco devolvido, navegação por teclado e formulário com erro focando primeiro campo inválido.
- [ ] Rodar red; implementar estados e motion por tabela da spec; animação não determina quando o dado fica pronto.
- [ ] Revisar hover/active/disabled/loading, tooltips, labels, plural, truncamento e ações com rascunho alterado.
- [ ] Verificar reduced motion em runtime; retirar zoom/deslocamento/shimmer; testar kanban e overlays sem regressões.
- [ ] Testes, typecheck, capturas das interações críticas e revisão independente.
- [ ] Registrar entrega de acabamento.

## Task 14 — revisão integral e entrega

**Files:** criar `docs/audit/redesign-2026-10-03/verification.md` e capturas próprias sem sobrescrever auditorias existentes.

- [ ] Percorrer cada linha da matriz da spec e marcar implementação/validação. Toda página tem proprietário e evidência; nenhuma permanece sem decisão de composição.
- [ ] Conferir 1440/1024/390 px, claro/escuro/cor personalizada, membro/admin, zoom200%, teclado/reduced motion, loading/empty/error.
- [ ] Testar navegação de ponta a ponta: login→Clientes→ficha→Negócio→Comunicação; busca por registro; filtro/exportação; alteração de etapa com falha simulada.
- [ ] Rodar `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`; comparar lint dos arquivos alterados ao HEAD sem stash de alterações do usuário.
- [ ] Registrar contagem de testes, limitações reais de ambiente e quaisquer falhas preexistentes por nome. Browser viewport efetivo deve ser observado antes de declarar mobile validado.
- [ ] Revisão independente final, corrigir problemas importantes, abrir preview e documentos de validação. Deploy/publicação somente quando solicitado.

## Entrega e checkpoints

Checkpoint A: autenticação confiável, fundação, sidebar e busca. Checkpoint B: Comunicação e operação diária. Checkpoint C: análise, configuração, ferramentas e páginas públicas. Checkpoint D: acabamento e revisão integral.

Recomendação de execução: agentes em módulos independentes após a fundação, com revisão por tarefa e uma revisão final integrada. A fundação não deve ser dividida entre agentes porque define os contratos de todas as páginas. O plano representa a reescrita completa; não executar somente a troca de tokens e declarar todas as páginas concluídas.
