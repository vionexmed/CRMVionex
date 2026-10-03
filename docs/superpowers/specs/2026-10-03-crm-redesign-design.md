# Vionex CRM — redesenho completo da experiência

Data: 03/10/2026. Documento consolidado a partir de três análises independentes do código: arquitetura de navegação e busca; composição de todas as páginas; interação, movimento e confiabilidade.

## Objetivo e decisões do usuário

Reescrever a apresentação visual de todas as páginas para tornar o CRM agradável, legível e confiável no trabalho comercial. O usuário rejeitou o login anterior, arredondamento excessivo, informações fragmentadas em cartões e sidebar poluída. Aprovou cantos discretos de 4–6 px, superfícies contínuas, divisórias e sombras mínimas. Pediu Comunicação reunindo WhatsApp, Instagram e e-mail, busca abaixo da logo na sidebar, animações elaboradas e revisão de detalhes e microdetalhes.

A primeira rodada já está aplicada localmente: login sem cartão flutuante, raio reduzido, botões sólidos, sidebar integrada, indicadores em faixa, gráficos com divisórias e filtros de país/cidade. Isso é uma base parcial; a nova arquitetura e a revisão página por página descritas aqui ainda serão implementadas.

## Referências de produto verificadas

Consulta em 03/10/2026 às fontes oficiais e às capturas de interface publicadas pelos produtos. O usuário pediu referências de CRMs ativos e consolidados. Estes padrões orientam a implementação; a marca, os dados e as permissões continuam sendo do Vionex.

| Referência | Padrão observado | Aplicação no Vionex |
|---|---|---|
| [Attio — navegação e busca](https://attio.com/help/reference/productivity-collaborating/navigating-your-workspace) | Busca no topo da sidebar; tabela contínua com ferramentas próximas dos registros; ações por teclado | Busca abaixo da marca, contraste discreto na seleção, separadores finos, ferramentas alinhadas à tabela |
| [Attio — fichas](https://attio.com/help/reference/managing-your-data/records/create-and-view-records) | Dados e histórico relacionados acessíveis a partir do registro | Fichas de contatos e empresas com propriedades agrupadas e atividade no mesmo contexto |
| [Pipedrive — funil](https://support.pipedrive.com/en/article/pipeline-view) | Etapas legíveis; negócio resume título, contato, valor e responsável; atividade acessível | Cartões compactos somente para negócios arrastáveis, prioridade de informação e acesso ao detalhe |
| [HubSpot — caixa de conversas](https://knowledge.hubspot.com/inbox/use-the-conversations-inbox) | Lista à esquerda, conversa no centro, contexto do contato à direita; filtros operacionais | Comunicação com canais, lista/detalhe integrados, composer persistente e contexto sem caixas redundantes |

Direção editorial decorrente: fundos neutros, bordas leves, densidade útil, tipografia consistente, ações primárias sólidas e cor reservada a seleção e estados. Evitar gradientes decorativos, ícones em ladrilhos, cards de informação repetidos, textos promocionais artificiais e elementos sem função. Animações devem explicar abertura, seleção, envio e arraste, sem competir com os dados. Os seis destinos e os tempos de movimento são decisões próprias aprovadas para Vionex, não alegações de que existem exatamente assim nas referências.

## Princípios de composição

Uma página é uma área de trabalho, não uma coleção de caixas. Cabeçalho, ferramentas, dados e ações formam uma superfície contínua, com divisórias somente onde há mudança de contexto. Cartões continuam apropriados para unidades independentes, como negócios arrastáveis e produtos com imagens. Seções informativas não usam cartões por padrão. Nenhuma tela ganha dados fictícios para parecer completa.

As permissões, dados, métricas, etapas do ciclo de vida, integrações e confirmação de exclusão são preservados. Reorganizar canais não significa mesclar mensagens ou conceder acesso. Funcionalidades indisponíveis permanecem identificadas. Alterações em RLS, credenciais, funções de envio, cobrança ou infraestrutura não fazem parte do redesenho visual.

## Navegação e arquitetura da informação

A sidebar terá seis destinos primários:

| Destino | Entrada | Navegação dentro da área |
|---|---|---|
| Painel | `/dashboard` | Visão geral, Indicadores, Assistente indisponível |
| Atividades | `/activities` | Lista, agenda/calendário e filtros existentes |
| Clientes | `/contacts` | Contatos, Empresas; Leads é filtro de contatos |
| Negócios | `/deals` | Funil, Produtos, Orçamentos |
| Comunicação | `/comunicacao/whatsapp` | WhatsApp, Instagram, E-mail; Templates e Sequências para admin |
| Análise | `/reports` | Relatórios, Metas; Marketing, Lead Scoring, Automações para admin |

Configurações, Equipe, Meu e-mail, Integrações e Segurança ficam no menu da conta com suas permissões atuais. A navegação secundária aparece dentro da área correspondente; nenhum módulo desaparece. `navegacao.ts` será a fonte única para menu, breadcrumbs, paleta e mobile. Aliases e rotas atuais serão explicitamente relacionados ao destino primário para manter a seleção correta ao abrir links diretos.

Sidebar expandida: 232 px, logo alinhada ao início da coluna, busca logo abaixo, navegação com itens de 40 px, rodapé da conta fixo. Recolhida: 64 px, símbolo da marca, busca e destinos com nome acessível e tooltip. Persistência da preferência é tolerante a storage indisponível. Cabeçalho mantém breadcrumbs e notificações, sem duplicar busca no desktop. Mobile: quatro entradas fixas — Painel, Clientes, Negócios e Comunicação — e Mais para as demais áreas; busca no cabeçalho quando a sidebar estiver fechada.

## Comunicação

Rotas canônicas: `/comunicacao/whatsapp`, `/comunicacao/instagram`, `/comunicacao/email`. `/conversations`, `/instagram` e `/inbox` continuam como aliases preservando parâmetros. `/settings/email` permanece disponível para configuração e retorno OAuth.

Um shell reúne nome da área, seletor de canal e navegação secundária. Reutiliza Conversations e Inbox com suas consultas e operações próprias. No desktop: lista de threads, leitura/conversa e contexto opcional do contato. No mobile: lista e detalhe alternados, retorno explícito e composer visível quando o teclado abre.

Seleção, pesquisa, rolagem e rascunho são independentes por canal e conversa. Uma falha de envio restaura o rascunho da conversa original, mesmo se o usuário tiver trocado de thread. Não refazer o fluxo de envio ao migrar o layout. Templates e Sequências mantêm RequireAdmin.

Conexão tem estados separados: verificando, conectado, desconectado e erro ao verificar. Mensagens têm carregando, vazio, falha, enviando e falha de envio. Janelas de atendimento e reconexão de conta são exibidas conforme os dados existentes. Instagram tem implementação no código, mas conexão e disponibilidade precisam ser verificadas no backend; não inferir funcionamento pelo simples fato de existir a página. Paginação e alcance da busca no histórico precisam ficar claros, pois há limites atuais de consulta.

## Busca global

O botão abaixo da logo abre a mesma paleta que Cmd/Ctrl+K. A paleta apresenta páginas e resultados agrupados de contatos, empresas e negócios. Páginas disponíveis aparecem imediatamente; entidades começam a consultar após dois caracteres, com debounce de 300 ms. Uma resposta antiga nunca substitui o termo atual.

Resultados têm ID estável, nome principal, identificação secundária e ação concreta. Contato e empresa abrem a ficha escolhida por `/contacts?id=…` e `/companies?id=…`, carregando por ID mesmo fora da primeira página. Negócio abre `/deals/:id`. Registro inacessível ou removido recebe estado recuperável, sem ficha de outra organização. Rotas administrativas ficam ocultas para membros na paleta.

Ao abrir: foco no campo. Setas navegam, Enter abre, Escape fecha e devolve foco ao acionador. Não publicar atalhos N/D/T ou `/` sem implementá-los e testar sua interação com inputs, contenteditable e modais. Loading, erro parcial, nenhum resultado e termo insuficiente são estados diferentes. Falha de uma categoria não apaga as outras.

Histórico local é isolado por usuário e organização, validado na leitura, limitado a cinco itens e apagável. Falha de localStorage nunca impede a navegação. Termos de busca passam pela sanitização apropriada à gramática PostgREST. A filtragem local do cmdk não deve descartar resultados já encontrados pelo servidor.

## Sistema visual

| Elemento | Regra |
|---|---|
| Superfície de página | Contínua; uma moldura quando há necessidade real de limitar a área |
| Raio | 6 px para superfícies/overlays; 4 px para controles; círculos apenas avatares e marcadores |
| Sombras | Nenhuma em seções, KPIs, tabelas e sidebar; sombra discreta em menus/overlays |
| Cores | Tokens semânticos; destaque acompanha ThemeContext em claro e escuro |
| Tipografia | Título 24 px desktop/20 px mobile; seção 16 px; corpo 13–14 px; secundário 12 px; 11 px só metadado curto |
| Espaçamento | Escala 4/8/12/16/24/32 px; página 24 px desktop, 16 px mobile; seção 24 px |
| Controles | Altura 40 px padrão; 36 px em toolbar desktop; área de toque de 44 px no mobile |
| Ícones | 16 px nos controles, 18 px na navegação; stroke consistente; alinhamento óptico |
| Indicadores | Faixa com divisórias; duas colunas mobile; sem ladrilho de ícone e sem sombra por indicador |
| Abas | Linha inferior, seleção clara; teclado Radix preservado; sem pílula flutuante |
| Formulário | Labels acima; seções em sequência; ações no contexto editado; erros junto ao campo |
| Detalhe | Área principal flexível e contexto lateral de 320 px; empilhar abaixo de 1024 px |
| Tabelas | Cabeçalhos legíveis, divisórias horizontais, números tabulares e alinhamento previsível |

Evoluir os componentes existentes em ui e layout. Criar somente os padrões ausentes: `MetricStrip`, `WorkSurface`, `SettingsRow`, `MasterDetailLayout`, `AuthLayout` e `CommunicationLayout`. Estes recebem conteúdo, não regras de banco ou permissões. A existência de componentes compartilhados não dispensa a revisão de cada página: retirar cartões redundantes e padding duplicado exige alterar a composição local.

## Matriz de todas as páginas

Os caminhos são relativos ao repositório, em `src/pages/`.

| Arquivo/fluxo | Composição e melhorias previstas |
|---|---|
| Login.tsx | Autenticação com marca e formulário livre; ajustar hierarquia, autocomplete, erros e loading; manter entrada, cadastro e link |
| ResetPassword.tsx | Mesmo AuthLayout; um título, formulário sem cartão, validação e confirmação coerentes |
| AcceptInvite.tsx | Convite/organização, cadastro e erros no mesmo eixo; distinguir convite inválido e falha de consulta |
| Dashboard.tsx | Faixa principal, evolução e funil contínuos; atualização explícita; zero, ausência de dados e sem fonte separados |
| Contacts.tsx | Tabela como visão principal; busca/filtros unificados; país/cidade; chips ativos; seleção segura; alternativas em células conectadas |
| Companies.tsx | Mesmo modelo de lista; ficha direta via busca; visão alternativa sem cards flutuantes |
| Deals.tsx | Funil/filtros/ações integrados; unidades de negócio compactas; lista/previsão consistentes; arraste com rollback explicado |
| DealDetail.tsx | Timeline principal e contexto lateral em seções; corrigir grid sem breakpoint; composer e ações de edição claros |
| Activities.tsx | Agrupar por data/situação; agenda legível mobile; calendário desktop sem comprimir sete colunas no celular |
| Produtos.tsx | Catálogo com imagens úteis e células conectadas; preços alinhados; formulário padrão |
| Orcamentos.tsx | Estados, busca e ações na toolbar; tabela contínua com contato, total, data e situação |
| OrcamentoPublico.tsx | Documento comercial único: identificação, itens, totais, condições e decisão; sem sidebar; estados da aprovação claros |
| Inbox.tsx | Dentro de Comunicação; pastas/lista/leitura integradas; ações agrupadas; mobile lista/detalhe; loading e reconexão corretos |
| Conversations.tsx — WhatsApp | Dentro de Comunicação; lista/conversa/contexto; janela e envio explícitos; preservar identidade e rascunho |
| Conversations.tsx — Instagram | Mesmo shell; estado real da conexão, vínculo e janela; manter consulta/envio separados do WhatsApp |
| MyEmail.tsx | Identidade/status/cota, assinatura editor/preview e ações da conexão em seções contínuas |
| EmailTemplates.tsx | Biblioteca em lista com assunto/preview; editor em painel consistente; acesso administrativo |
| EmailSequences.tsx | Lista e editor; passos em timeline conectada; inscritos em tabela; estados reais de execução |
| LeadScoring.tsx | Regras e segmentos em seções/linhas; contatos e histórico tabelados; não confundir regra com resultado |
| Automations.tsx | Lista operacional com estado/erros; templates conectados; builder gatilho→condições→ações |
| SalesGoals.tsx | Mês, faixa de progresso e tabela; ausência de meta não vira valor zero silencioso |
| Reports.tsx | Filtros globais, indicadores em faixa, gráficos divididos e detalhamento tabelado em todas as cinco abas |
| Team.tsx | Tabela de membros, convite compacto, pendentes e permissões em seções; ações restritas preservadas |
| Settings.tsx | Navegação secundária consistente, coluna de leitura adequada e linhas de configuração |
| SecuritySettings.tsx | Auditoria em tabela, sessões agrupadas por usuário e política em seção; sem caixa por dispositivo |
| Integrations.tsx | Catálogo com status real e configuração contextual; áreas técnicas legíveis; credenciais não expostas pelo redesign |
| Marketing.tsx | Preservar redirecionamento/Outlet; não adicionar segunda casca |
| marketing/Overview.tsx | Remover padding duplicado e raios explícitos; adotar shell, faixas/gráficos/tabelas; limitar animações de métricas |
| NotFound.tsx | Estado simples com ação útil; manter navegação correta para usuário autenticado e visitante |

Aliases `/leads`, `/tasks`, `/setup` continuam válidos. Nenhuma nova página de lead ou tarefa será criada.

Cobertura interna obrigatória: GeneralTab, PipelinesTab, CustomFieldsTab, NotificationsTab, AppearanceTab, BillingTab, EmailSignatureTab, MinhaAssinatura e SessionsPanel; SalesReport, ActivitiesReport, ContactsReport, ForecastReport e CustomReportBuilder; abas de integrações; ContactDrawer, CompanyDrawer, criação/importação, EmailComposeModal, formulário de produto, construtor/painel de orçamento, onboarding e paleta.

## Microdetalhes obrigatórios

- Ação primária única por contexto; secundárias discretas; exclusão separada. Botão não muda de largura em loading; spinner ocupa o lugar do ícone, texto explica a ação.
- Foco visível imediato de 2 px; nenhum controle depende exclusivamente de hover. Botões de ícone têm nome acessível; tooltip não substitui label.
- Linha clicável oferece teclado sem interferir no checkbox e nos botões da linha. Seleção e atualização são anunciadas de forma breve.
- Labels, placeholders e ajuda têm funções distintas. Obrigatório fica explícito. Campos de telefone, e-mail e senha usam tipos e autocomplete adequados.
- Valores monetários à direita, datas no formato do produto, telefones/e-mails legíveis; truncamento oferece acesso ao valor completo. Contagens têm plural correto e números tabulares.
- Barra de filtros mostra critério aplicado e estado de atualização. Filtro sem resultado oferece Limpar filtros. Exportação usa exatamente o snapshot aplicado à lista.
- Mudança de consulta/ordem limpa ou reconcilia seleção. Dados anteriores durante atualização são identificados e não permitem exclusão de uma seleção obsoleta.
- Skeleton representa a geometria real; refetch não desmonta o conteúdo. Erro preserva contexto e oferece tentativa novamente.
- Rascunho sobrevive a falha de salvamento/envio. Fechamento sem mudanças é direto; conteúdo alterado pede confirmação de descarte, sem confirmação em cada clique.
- Modal tem cabeçalho, conteúdo rolável e ações visíveis; no mobile não ultrapassa a viewport. Drawer mantém nome do registro e ação de fechar acessíveis.
- Toast de sucesso só depois de resposta confirmada. Erros usam mensagemErro; nunca `[object Object]`. Não esconder falha de consulta sob vazio.
- Conteúdo offline não promete fila ou sincronização que o produto não implementou.
- Tema escuro e cor personalizada preservam contraste: texto normal mínimo 4,5:1, controles/indicadores essenciais 3:1.

## Motion

Curva padrão `cubic-bezier(.2,.8,.2,1)`; movimento deve explicar mudança de estado, com resposta imediata ao clique.

| Interação | Duração/propriedades |
|---|---|
| Hover de botão/nav | 120–160 ms, cor/background/borda |
| Seleção ativa | 160 ms, indicador e fundo; texto permanece no lugar |
| Busca | Overlay 120 ms; painel 180 ms, opacity e deslocamento 4 px |
| Resultados | Sem reentrada de toda a lista por tecla; transição local 120 ms |
| Página | Opacity 160 ms somente conteúdo, sem transform no ancestral do kanban |
| Modal | 180–200 ms, opacity e escala 0,985→1 |
| Drawer | Entrada 240 ms, saída 180 ms; respeitar foco e rolagem |
| Chips/feedback | 120–140 ms, opacity; evitar saltos na barra de ações |
| Kanban | Destino 120 ms por borda/background; drop 160 ms; pointer sem atraso |
| Gráfico | 250–400 ms na primeira apresentação; não reanimar números em cada refetch |

`prefers-reduced-motion: reduce` elimina deslocamento, zoom, stagger, shimmer e pulso; fade opcional até 80 ms. Sem confete decorativo em operações rotineiras. DragOverlay deve ficar em document.body. Não aplicar transform, filter, scale ou backdrop em ancestrais de kanban nem remover transforms internos do dnd-kit.

## Correções funcionais ligadas à confiança

A auditoria identificou: perfil sem loading ao entrar e cargas concorrentes; sucesso de addActivity sem checar erro; rollback de etapa sem feedback; paleta com rota de login, duplicação, permissões divergentes, links sem ID e respostas obsoletas; falso vazio/desconectado durante consultas; seleção/exportação durante debounce.

São achados de código. A mensagem temporária de perfil ausente foi observada no navegador, mas a causa precisa ser reproduzida em teste antes da correção. Limites de 200 e-mails e 2.000 mensagens existem no código; paginação será tratada em tarefa funcional separada, sem alterar o contrato de envio ou políticas de acesso.

## Aceite e revisão

Cobrir todas as páginas acima em 1440, 1024 e 390 px, claro/escuro, usuário membro/admin, vazio, loading, erro e dados reais autorizados. Sem overflow horizontal de página; scroll lateral somente dentro de tabela/kanban. Conferir zoom 200%, teclado e reduced motion. Consultas/ações externas nos testes usam transporte controlado; não enviar mensagens nem apagar dados reais para verificar o redesign.

Verificações: typecheck, testes de comportamento, build, diff check e comparação do lint ao baseline. Os testes existentes que congelam uma escolha estética precisam ser atualizados quando o requisito mudou; novos testes devem cobrir comportamento, não procurar classes no fonte.

A revisão final deve percorrer a matriz inteira e registrar capturas. A primeira rodada passou 1.381 testes, typecheck e build; lint dos arquivos alterados não aumentou. O filtro Campinas encontrou um contato na sessão atual. A conferência visual feita até aqui cobre desktop; a tentativa de override de viewport não alterou as dimensões efetivas do navegador, portanto o aceite mobile permanece pendente.
