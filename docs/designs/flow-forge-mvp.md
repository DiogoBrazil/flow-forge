# Flow-Forge — Especificação de Design Técnico (MVP / Etapa 1)

*   **Author:** DiogoBrazil
*   **Status:** Proposed
*   **Date:** 2026-11-19

---

## Overview

O Flow-Forge é uma aplicação web *local-first* para modelagem visual multinível, navegação hierárquica e validação estrutural determinística de arquiteturas de software e sistemas distribuídos durante concepção e *design review*, antes da implementação em código.

Na Etapa 1 (MVP), a aplicação opera sobre uma fonte única de verdade que separa o modelo semântico da projeção visual (`views[]`) e integra dois níveis hierárquicos com semânticas distintas:

1.  **Nível 1 — Topologia Distribuída:** representa clientes, gateways, serviços, bancos de dados, caches, brokers de mensageria e sistemas externos ligados por relações de comunicação em tempo de execução (*runtime*).
2.  **Nível 2 — Arquitetura Interna de Serviço:** representa adaptadores, casos de uso, componentes de domínio e interfaces ligados por relações de dependência estática de código.

Os dois níveis são conectados por um vínculo explícito de fronteira (**`Boundary Binding`**): as conexões externas incidentes a um serviço aparecem projetadas na seção fixa "Fronteira Externa" do painel inspetor (com direção, nó vizinho, protocolo e status de vinculação) para associação manual aos adaptadores internos, que exibem indicadores contextuais (*badges*) no canvas. Validadores determinísticos em código inspecionam o modelo declarado e exibem diagnósticos não bloqueantes ligados aos elementos afetados.

O MVP executa integralmente no navegador (armazenamento local em IndexedDB e arquivos JSON versionados) e adota o **Princípio da Inversão de Dependências (DIP / Ports & Adapters)** como restrição arquitetural permanente do próprio código do Flow-Forge.

## The Problem

Durante o planejamento e a revisão de sistemas (*design review*), desenvolvedores e arquitetos enfrentam uma lacuna entre duas categorias de ferramentas:

*   **Editores visuais genéricos (draw.io, Excalidraw, Miro):** permitem desenhar caixas e setas com rapidez, mas não atribuem semântica verificável aos elementos. Cada diagrama é isolado; renomear um serviço ou alterar uma conexão não preserva consistência entre a topologia distribuída e a arquitetura interna, e violações arquiteturais (dependências proibidas entre camadas, ciclos, interfaces sem implementação ou divergências entre fronteira externa e adaptadores internos) passam despercebidas até a codificação.
*   **Ferramentas *model-as-code* (Structurizr DSL, LikeC4, Mermaid):** mantêm fonte única de verdade e permitem automação, mas exigem escrita e manutenção manual de DSL antes de visualizar o sistema, criando atrito em sessões exploratórias e discussões arquiteturais interativas.

Ferramentas de validação arquitetural sobre código-fonte (ArchUnit, Dependency Cruiser) atuam apenas após o código existir. Falta uma ferramenta visual direta, executável localmente sem servidor, que estruture um sistema em dois níveis integrados e verifique de forma determinística a consistência do **projeto arquitetural declarado** antes de escrever código.

**Limite explícito da proposta:** modelos manuais sofrem risco de *architecture drift* quando comparados à implementação posterior. O MVP (Etapa 1) não lê repositórios nem valida código real; sua função é verificar a consistência do modelo declarado durante a concepção. Evoluções previstas fora deste documento cobrem fluxos de execução (Etapa 2), simulação/implantação (Etapa 3) e comparação com código-fonte e colaboração (Etapa 4).

## Goals

Os critérios de sucesso da Etapa 1 (MVP) são:

*   **G1 — Modelagem visual multinível sem colisão semântica:** permitir criar e editar projetos com 1 visão canônica por nível hierárquico (Topologia Distribuída no Nível 1; Arquitetura Interna por `service` no Nível 2), navegados por *drill-down* e *breadcrumbs*, mantendo a separação estrita entre identidade/dados do modelo e coordenadas visuais (`views[]`).
*   **G2 — Coerência entre níveis via `Boundary Binding` explícito:** projetar a fronteira externa de cada serviço na seção "Fronteira Externa" do painel inspetor (exibindo direção, protocolo, nó vizinho e status) e em badges contextuais nos adaptadores no canvas, permitindo vinculação manual explícita sem inferência automática da arquitetura interna e detectando divergências entre os dois níveis.
*   **G3 — Glossário fechado e leitura inequívoca de direções:** adotar vocabulário sem ambiguidade no metamodelo e na UI (`Handle`, `Endpoint`, `Interface`, `View`, `Scope / Level`) e diferenciar visualmente setas de comunicação em runtime (Nível 1) de setas de dependência estática (Nível 2).
*   **G4 — Validação determinística não bloqueante:** separar invariantes estruturais bloqueantes (integridade persistível) de diagnósticos arquiteturais não bloqueantes em código (sem DSL própria), detectando ciclos, violações de camada, interfaces sem implementação, conexões incompatíveis e falhas de `Boundary Binding`, cada qual com `ruleId`, severidade, evidência e navegação direta ao elemento afetado.
*   **G5 — Edição reversível e layout previsível:** suportar *Undo/Redo* atômico por 50 snapshots imutáveis confirmados em memória (por projeto/sessão) e layout automático estritamente sob demanda, reversível em um único *Undo*, sem sobrescrever posições manuais.
*   **G6 — Persistência local-first segura e portável:** gerenciar projetos em IndexedDB (`idb`) com gravação atômica por projeto via controle otimista de revisão persistida, fila serializada de autosave com `flush()` ao trocar/fechar projeto, aviso de alterações não salvas (`beforeunload`), exportação JSON determinística (`schemaVersion: 1`), pipeline de importação seguro (verificação pré-parse de tamanho, validação de `schemaVersion === 1` rejeitando versões futuras, schema estrito e integridade referencial), recuperação por download JSON em falhas de gravação/quota/conflito de revisão e diagnóstico local mínimo exportável.
*   **G7 — Inversão de Dependências (DIP / Ports & Adapters) verificável em CI:** estruturar o Flow-Forge como monólito modular em projeto único (Vite + TypeScript + Vue 3), com domínio, regras e casos de uso desacoplados de Vue, biblioteca visual, IndexedDB, motor de layout e APIs de navegador, usando contratos formais nas fronteiras externas reais (`ProjectRepository`, `LayoutPort`), Composition Root explícito e fiscalização automatizada em CI via `dependency-cruiser` (ADR-001).
*   **G8 — Comprovação técnica e prática de utilidade:**
    1.  Aprovar todos os testes automatizados sobre modelos de exemplo (válido e com defeitos injetados cobrindo todas as regras).
    2.  Modelar manualmente no aplicativo ao menos dois sistemas reais anonimizados: (a) uma API em Ports & Adapters (casos de uso, interfaces e adaptadores) e (b) um sistema distribuído com serviços, banco, cache, broker e um serviço com arquitetura interna e `Boundary Binding`.
    3.  **Critério objetivo de aprovação de G8:** ambos os modelos reais passam pelo pipeline de importação com zero erros estruturais e são acompanhados de avaliação documentada em `docs/validation/real-systems-evaluation.md` preenchendo cinco dimensões obrigatórias: atrito de edição (cliques/tempo), clareza das direções de seta, navegação entre níveis, precisão dos diagnósticos e limitações observadas frente à verificação de código real.

## Non-Goals

Os itens abaixo estão fora do escopo da Etapa 1 e não devem motivar campos especulativos no schema `v1` nem abstrações antecipadas no código:

*   **Múltiplas visões parciais arbitrárias do mesmo nível:** não implementar Model Explorer (árvore global de reuso entre visões parciais), sincronização de visões parciais nem a distinção "remover da visão" versus "excluir do modelo" (o schema mantém `views[]` pronto para evolução futura).
*   **Grupos aninhados arrastáveis e `Handle`s configuráveis pelo usuário:** não implementar contêineres redimensionáveis aninhados no mesmo canvas nem criação/posicionamento arbitrário de conectores gráficos pelo usuário.
*   **Projeção de `ProjectedEndpoint`s como nós posicionáveis no canvas:** no MVP, a fronteira externa é gerenciada no painel inspetor com badges nos adaptadores; visualização direta como nós/arestas no canvas fica reservada como evolução futura sem incluir `endpointPositions` no schema `v1`.
*   **Drill-down em `gateway` ou 4ª camada `infrastructure`:** no MVP, apenas nós `kind: 'service'` abrem arquitetura interna e o Nível 2 opera sobre 3 camadas (`adapters`, `application`, `domain`).
*   **Infraestrutura de migração e `migration_backups` na `v1`:** na `v1` inicial não existe versão anterior; a aplicação valida `schemaVersion === 1` e rejeita versões futuras. Pipeline de migração linear e backup pré-migração entram quando existir `v2`.
*   **Coordenação multi-aba via `BroadcastChannel` e `onblocked`:** a proteção contra sobrescrita silenciosa no MVP é feita pela transação atômica com checagem de `persistedRevision` no IndexedDB.
*   **Perfis de regras independentes por serviço:** o perfil é configurado no nível do projeto, respeitando o tipo e a semântica de cada elemento.
*   **Motor de comandos inversíveis, histórico persistido e Pinia:** não implementar padrão Command com `undo()` inverso manual, não persistir histórico de *Undo/Redo* e não adotar Pinia (estado de apresentação em composable Vue puro).
*   **Monorepo multipacotes, container de DI, portas artificiais e observabilidade complexa:** não dividir em múltiplos pacotes npm, não usar framework de DI, não criar interfaces artificiais para validadores/ID/relógio nem subsistema formal de telemetria.
*   **Recursos de etapas futuras:** fluxos de execução condicionais (Etapa 2: caminhos alternativos, erros, retries, timeouts), simulação de carga/latência/falhas e implantação detalhada com ambientes/réplicas (Etapa 3), DSL própria de regras, análise de repositórios/código-fonte, colaboração em tempo real, autenticação, backend remoto, versão desktop (Wails/Tauri), plugins externos, geração de código e assistente de IA (Etapa 4).

## Open Questions

As duas questões abaixo dependem exclusivamente das evidências da spike técnica descartável (Fatia 0, pré-implementação):

*   **OQ1 — Validação experimental de canvas (`@xyflow/vue` v2 vs. `@xyflow/react`):** confirmar em protótipo descartável nós customizados, handles técnicos, conexões tipadas, drill-down, fluxo unidirecional (`@nodes-change` + `applyNodeChanges` em buffer local `shallowRef`), compatibilidade de `exactOptionalPropertyTypes: true` com `vue-tsc`, ausência de `DataCloneError` e responsividade em carga progressiva (50, 150 e 300 nós). Migrar para `@xyflow/react` apenas se houver bloqueio técnico concreto ou degradação severa exclusiva do wrapper Vue (ver Seção 7).
*   **OQ2 — Seleção final do adaptador de layout (`@dagrejs/dagre` / `elkjs` direto vs. `elkjs` em Web Worker):** medir tempo de cálculo, ausência de sobreposição e tamanho de bundle em `vite build` + `vite preview` para 50 e 300 nós antes de congelar o adaptador atrás de `LayoutPort` (ver Seção 7).

## Critical User Journeys (CUJs)

### CUJ 1: Modelar topologia distribuída e detalhar arquitetura interna com `Boundary Binding`

*   **Given**: O usuário abriu o Flow-Forge no navegador, criou um projeto local e está na visão canônica do Nível 1 (`system`).
*   **When**:
    1.  Adiciona `Web Client`, `API Gateway`, `Orders API` (`service`) e `PostgreSQL` (`database`) e cria conexões de comunicação em runtime (`Web Client → API Gateway → Orders API → PostgreSQL`).
    2.  Aciona *drill-down* em `Orders API` para abrir a visão canônica do Nível 2 (`internal:<serviceId>`).
    3.  Visualiza na seção "Fronteira Externa" do painel inspetor os `Endpoint`s projetados (`inbound` de `API Gateway` [HTTP] e `outbound` para `PostgreSQL` [SQL]).
    4.  Cria `HTTP Adapter`, `CreateOrder UseCase`, `OrderRepository Interface` e `PostgresOrderAdapter`.
    5.  Cria as dependências estáticas (`HTTP Adapter → CreateOrder UseCase → OrderRepository Interface` como `depends-on`, e `PostgresOrderAdapter → OrderRepository Interface` como `implements`).
    6.  Vincula manualmente no painel inspetor `HTTP Adapter` ao `Endpoint` `inbound` de `API Gateway` e `PostgresOrderAdapter` ao `Endpoint` `outbound` para `PostgreSQL`.
*   **Then**:
    *   As setas de comunicação em runtime (Nível 1) e de dependência estática (Nível 2) exibem estilos visuais e indicadores de direção distintos conforme o glossário fechado.
    *   Os cards de `HTTP Adapter` e `PostgresOrderAdapter` exibem badges contextuais indicando suas fronteiras externas vinculadas (`← HTTP: API Gateway` e `→ SQL: PostgreSQL`).
    *   O *breadcrumb* exibe `Topologia > Orders API` e permite retornar ao Nível 1 sem perder as posições manuais de nenhuma visão.
    *   Após o ciclo de revalidação (debounce de 200 ms), nenhum diagnóstico de `Boundary Binding`, camada ou interface não implementada é reportado.

### CUJ 2: Diagnosticar e corrigir violações arquiteturais e divergências entre níveis

*   **Given**: O usuário abriu um projeto de exemplo com defeitos intencionais (ou introduziu violações durante um rascunho): um `UseCase` com `depends-on` direto para `PostgresOrderAdapter` (violação de camada), um ciclo entre dois componentes internos, uma `Interface` sem `implements` e uma conexão externa `Orders API → Redis` sem adaptador interno vinculado.
*   **When**: O usuário observa o painel de diagnósticos atualizado automaticamente e clica em cada item listado.
*   **Then**:
    *   Nenhuma das violações arquiteturais bloqueou a criação ou abertura do modelo estruturalmente íntegro.
    *   Cada diagnóstico exibe `ruleId`, severidade, explicação objetiva com evidência (ex.: caminho ordenado do ciclo) e navega automaticamente ao `scope` afetado destacando os elementos.
    *   Ao redirecionar a dependência para a interface, quebrar o ciclo, adicionar a aresta `implements` e vincular o adaptador de cache ao `Endpoint` externo do `Redis`, os diagnósticos desaparecem após a revalidação determinística (debounce de 200 ms).

### CUJ 3: Organizar layout sob demanda e reverter alterações com Undo/Redo atômico

*   **Given**: O usuário posicionou manualmente os elementos de um nível e realizou edições estruturais confirmadas.
*   **When**: O usuário arrasta um nó pelo canvas, solta na posição final, aciona o botão "Organizar layout" e em seguida pressiona `Ctrl+Z` (Undo) e `Ctrl+Shift+Z` (Redo).
*   **Then**:
    *   Os quadros intermediários durante o arraste não geram entradas na pilha de *Undo* nem gravações no IndexedDB.
    *   O layout automático reorganiza apenas a visão ativa e somente quando acionado explicitamente.
    *   Um único `Ctrl+Z` restaura exatamente todas as coordenadas anteriores ao layout, mantendo consistência entre modelo e visões; o histórico permanece limitado a 50 snapshots confirmados em memória.

### CUJ 4: Persistir localmente, exportar JSON versionado, importar com segurança e recuperar falhas

*   **Given**: O usuário possui um projeto editado com topologia distribuída, arquitetura interna e `Boundary Binding` salvo automaticamente no IndexedDB.
*   **When**: O usuário tenta fechar a aba com alterações pendentes, aguarda o salvamento, recarrega a página, exporta o projeto para JSON, tenta importar arquivos inválidos (acima de 5 MB, com `schemaVersion: 99`, com campo desconhecido ou referência órfã) e depois importa o JSON válido exportado anteriormente.
*   **Then**:
    *   Enquanto houver gravação pendente, o navegador aciona a confirmação `beforeunload`.
    *   Após recarregar a página, o projeto reabre integralmente a partir do IndexedDB sem perda de elementos, vínculos ou posições.
    *   Arquivos inválidos são rejeitados antes de alterar o IndexedDB, exibindo mensagem legível indicando a causa exata (tamanho excedido, versão futura incompatível, erro de campo de schema ou referência órfã).
    *   Na importação de JSON válido cujo `id` já existe localmente, o usuário escolhe explicitamente entre "Importar como cópia" ou "Substituir projeto existente".
    *   Em caso de erro de quota/escrita ou conflito de revisão externa no IndexedDB, um banner exibe opções imediatas para **Recarregar do IndexedDB** ou **Baixar JSON da memória**.

---

## Technical Plan (Architecture)

### 1. Glossário Fechado e Diferenciação Visual de Semântica

Os cinco termos abaixo têm definição única e mutuamente exclusiva no metamodelo do usuário, nos testes e na interface. O termo **`Port` / Contrato** é reservado exclusivamente à arquitetura interna do código-fonte do Flow-Forge (ADR-001) e não aparece na interface do usuário para nomear elementos do diagrama.

| Termo (Metamodelo / UI) | Definição Fechada no MVP | Onde Vive |
| :--- | :--- | :--- |
| **`Handle`** | Ponto técnico de conexão gráfica fornecido pela biblioteca visual para iniciar ou encerrar o gesto de arrastar uma aresta. Não possui significado arquitetural próprio. | `diagram-adapter` / `ui` |
| **`Endpoint`** | Projeção somente-leitura da fronteira de comunicação externa de um serviço (`inbound` ou `outbound`), derivada das conexões `RuntimeConnection` incidentes a ele no Nível 1 e exibida na seção "Fronteira Externa" do painel inspetor. | Projeção derivada (`src/domain/projection.ts`) |
| **`Interface`** | Elemento estático do Nível 2 (`CodeUnit` com `kind: 'interface'`) que representa uma abstração de código (ex.: `OrderRepository`) consumida por casos de uso e implementada por adaptadores. | `src/domain/` (Nível 2) |
| **`View`** | Projeção visual que armazena apenas coordenadas `(x, y)` dos nós do nível. Na Etapa 1 existe 1 visão canônica por `Scope / Level`, preservando `views[]` no JSON `v1`. | `src/domain/` (`ArchitectureView`) |
| **`Scope / Level`** | Nível semântico do modelo: `system` (Nível 1 — Topologia Distribuída) ou `internal:<serviceId>` (Nível 2 — Arquitetura Interna de um serviço). | `src/domain/` |

**Diferenciação visual obrigatória de direções:**
*   **Nível 1 — Comunicação Síncrona e Acesso a Dados (`sync-call`, `data-access`, `cache-access`):** seta segue quem inicia a chamada (`source → target`, ex.: `Orders API → PostgreSQL`). Linha sólida com rótulo do protocolo (`HTTP`, `gRPC`, `SQL`, `Redis`, `Custom`) e indicador durante o arraste `A chama / acessa B`.
*   **Nível 1 — Mensageria Assíncrona com Broker (`async-publish`, `async-consume`):** seta segue o **fluxo da mensagem**:
    *   `async-publish`: `Produtor → Broker` (linha tracejada, rótulo `AMQP`/`Kafka`/`Custom`, indicador `A publica evento em B`; projeta `Endpoint` `outbound` no produtor).
    *   `async-consume`: `Broker → Consumidor` (linha tracejada, rótulo `AMQP`/`Kafka`/`Custom`, indicador `Broker entrega evento para B`; projeta `Endpoint` `inbound` no consumidor, compatível com `inbound-adapter`).
*   **Nível 2 — Dependência Estática (`depends-on`, `implements`):** seta segue o sentido da dependência em tempo de compilação (`source → target`):
    *   `depends-on`: linha contínua com ponta aberta e indicador `A depende de B`.
    *   `implements`: linha pontilhada com ponta triangular vazada e indicador `A implementa B` (ex.: `PostgresOrderAdapter → OrderRepository Interface`).
*   **Representação visual de `Boundary Binding` no MVP:** no Nível 2, a seção fixa "Fronteira Externa" do `InspectorPanel` lista todos os `ProjectedEndpoint`s do serviço (direção, nó vizinho, protocolo e adaptadores vinculados/pendentes). No canvas, cada adaptador vinculado exibe badges contextuais (ex.: `← HTTP: API Gateway`, `→ SQL: PostgreSQL`), e adaptadores sem vínculo exibem badge de aviso.

---

### 2. Arquitetura Modular e ADR-001 (Inversão de Dependências — DIP / Ports & Adapters)

**Diretriz permanente:** a Inversão de Dependências (DIP) é obrigatória e **não está sujeita a cortes YAGNI**. O repositório é organizado como monólito modular em projeto único (Vite + TypeScript + Vue 3), com todas as dependências apontando estritamente das bordas para o núcleo:

```text
+-----------------------------------------------------------------------------+
|                        src/composition/ (Composition Root)                  |
|            Instancia adapters e conecta contratos aos casos de uso          |
+-------+-------------------------+-------------------------+-----------------+
        |                         |                         |
        v                         v                         v
+---------------+       +-------------------+      +----------------------+
|    src/ui/    |       |  src/storage/     |      |     src/layout/      |
| Vue 3 +       |       | IndexedDB (idb)   |      | Dagre / ELK Adapter  |
| useWorkspace  |       +---------+---------+      +----------+-----------+
+---+---+-------+                 |                           |
    |   |                         | (implementa               | (implementa
    |   +----------------+        |  ProjectRepository)       |  LayoutPort)
    v                    |        |                           |
+-------------------+    |        v                           v
|src/diagram-adapter|    +---> +----------------------------------------------+
|  @xyflow/vue v2   |          |          src/application/ (Use Cases)        |
| (composable Vue)  |          |  Orquestra comandos, SnapshotHistory (TS),   |
+---------+---------+          |  import/export, persistência e layout        |
          |                    |  Define Ports: ProjectRepository, LayoutPort |
          | (usa tipos         +---+------------------+------------------+----+
          |  read-only)            |                  |                  |
          v                        v                  v                  v
+-------------------+   +------------------+  +---------------+  +------------+
|   src/rules/      |-->|   src/domain/    |<-| src/schemas/  |  |src/examples|
| Validadores puros |   | Entidades,       |  | Zod v4.3+     |  | JSON bruto |
| (Tarjan, camadas) |   | invariantes,     |  | DTO v1,       |  | (sem       |
+-------------------+   | limites, comandos|  | serializer    |  |  imports)  |
                        +------------------+  +---------------+  +------------+
                                 ^
                                 | (storage usa schemas para serializar DTO)
                        [src/storage/ -> src/schemas/]
```

#### ADR-001 — Regra Arquitetural Permanente: Inversão de Dependências (DIP)

*   **Status:** Proposed (restrição arquitetural permanente desde o início do projeto).
*   **Separação semântica explícita:** a direção de dependências do código-fonte do Flow-Forge (camadas externas dependendo de contratos internos) é independente do sentido das relações desenhadas pelo usuário nos diagramas.
*   **Contratos formais nas fronteiras externas reais (Ports em `src/application/ports/`):**

| Contrato (Port) | Definido Em | Adapters Concretos (Borda) | Fake em Testes |
| :--- | :--- | :--- | :--- |
| `ProjectRepository` | `src/application/ports/ProjectRepository.ts` | `src/storage/IndexedDBProjectRepository.ts` (`idb`) | `InMemoryProjectRepository` |
| `LayoutPort` | `src/application/ports/LayoutPort.ts` | `src/layout/DagreLayoutAdapter.ts` ou `src/layout/ElkWorkerLayoutAdapter.ts` (decidido na Fatia 0) | `StubLayoutAdapter` |

*   **Sem abstrações artificiais nem vazamento de dependências:**
    *   Gerador de ID e relógio são passados como funções opcionais com padrão nativo (`idGenerator: () => string = () => crypto.randomUUID()`, `clock: () => string = () => new Date().toISOString()`), garantindo determinismo total em testes sem criar arquivos de interface de método único.
    *   Serviços puramente determinísticos em memória (`src/domain/`, `src/rules/`, `src/schemas/`, `src/diagram-adapter/projection.ts`) são invocados diretamente sem interfaces de um único implementador.
    *   `src/application/` pode importar `src/schemas/` diretamente (serialização/validação pura em memória, sem I/O) e `src/examples/` (que contém apenas JSON bruto e metadados, sem nenhum import interno).
    *   Diagnóstico local mínimo (`src/ui/diagnostics/localDiagnosticLog.ts`) reside na borda de apresentação sem exigir porta formal na camada de aplicação.
    *   Novas portas serão extraídas quando surgirem fronteiras externas reais (ex.: `SimulationPort` na Etapa 3).
*   **Composition Root único:** `src/composition/createAppContainer.ts` instancia os adapters concretos e os injeta nos casos de uso, sem container/framework de DI.
*   **Matriz de dependências fiscalizada em CI (`dependency-cruiser`):**

| Módulo | Imports Internos Permitidos | Imports Externos Proibidos |
| :--- | :--- | :--- |
| `src/domain/` | Nenhum outro módulo | Qualquer pacote npm ou API DOM (`vue`, `@xyflow/vue`, `zod`, `idb`, `elkjs`, `@dagrejs/dagre`, `window`, `document`) |
| `src/rules/` | `src/domain/` | Qualquer pacote npm ou API DOM |
| `src/schemas/` | `src/domain/` | Tudo exceto `zod` |
| `src/examples/` | Nenhum outro módulo | Qualquer pacote npm |
| `src/application/` | `src/domain/`, `src/rules/`, `src/schemas/`, `src/examples/` | `vue`, `@xyflow/vue`, `idb`, `elkjs`, `@dagrejs/dagre`, APIs DOM (`File`, `window`, `document`), `storage/`, `layout/`, `diagram-adapter/`, `ui/`, `composition/` |
| `src/storage/` | `src/application/ports/`, `src/domain/`, `src/schemas/` | `vue`, `@xyflow/vue`, `layout/`, `diagram-adapter/`, `ui/` |
| `src/layout/` | `src/application/ports/`, `src/domain/` | `vue`, `@xyflow/vue`, `idb`, `storage/`, `ui/` |
| `src/diagram-adapter/` | `src/domain/`, `src/rules/` | `idb`, `storage/`, `layout/`, `composition/` |
| `src/ui/` | `src/application/`, `src/domain/`, `src/rules/`, `src/diagram-adapter/` | `idb`, `elkjs`, `@dagrejs/dagre`, `src/storage/`, `src/layout/`, `src/composition/` (recebe `AppContainer` por injeção via `provide/inject` a partir de `src/main.ts`) |
| `src/composition/` | Todos exceto `src/ui/` | `vue`, `@xyflow/vue` |
| `src/main.ts` | `src/composition/`, `src/ui/`, `src/styles/` | `idb`, `elkjs`, `@dagrejs/dagre`, `src/storage/`, `src/layout/` |

*   **Critérios verificáveis da ADR-001:**
    1.  `npm run depcruise` (`dependency-cruiser` configurado com `tsConfig`, `tsPreCompilationDeps: true`, `extensions: ['.ts', '.js', '.vue']` e `@vue/compiler-sfc`) falha o CI diante de qualquer violação da matriz acima ou ciclo entre módulos.
    2.  Toda a suíte `unit` (`domain/`, `rules/`, `schemas/`, `application/`) executa em Node puro no Vitest sem `jsdom`/`happy-dom`, sem IndexedDB real e sem montar componentes Vue.

---

### 3. Modelo de Domínio Unificado e Ciclo de Vida do `Boundary Binding`

Todas as entidades de domínio são objetos TypeScript planos e imutáveis (`readonly` em tempo de compilação; novas versões construídas por *spread* imutável, sem `Object.freeze` em runtime e sem `Proxy` do Vue), identificados por IDs estáveis (`EntityId`).

```ts
// Contratos normativos de domínio (src/domain/types.ts)

export type EntityId = string;

export type RuleProfileId = 'hexagonal' | 'layered' | 'distributed-baseline';

export type SystemNodeKind =
  | 'client'
  | 'gateway'
  | 'service'
  | 'database'
  | 'cache'
  | 'broker'
  | 'external-system';

export type RuntimeConnectionKind =
  | 'sync-call'
  | 'async-publish'
  | 'async-consume'
  | 'data-access'
  | 'cache-access';

export type RuntimeProtocol = 'http' | 'grpc' | 'sql' | 'redis' | 'amqp' | 'kafka' | 'custom';

export type CodeUnitKind =
  | 'inbound-adapter'
  | 'outbound-adapter'
  | 'use-case'
  | 'domain-service'
  | 'domain-entity'
  | 'interface';

export type CodeLayer = 'adapters' | 'application' | 'domain';

export type StaticDependencyKind = 'depends-on' | 'implements';

export interface ArchitectureProject {
  readonly id: EntityId;
  readonly name: string;
  readonly description: string;
  readonly ruleProfile: RuleProfileId;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly topology: DistributedTopology;
  readonly internals: Record<EntityId, InternalArchitecture>;
  readonly bindings: readonly BoundaryBinding[];
  readonly views: readonly ArchitectureView[];
}

export interface DistributedTopology {
  readonly nodes: readonly SystemNode[];
  readonly connections: readonly RuntimeConnection[];
}

export interface SystemNode {
  readonly id: EntityId;
  readonly name: string;
  readonly kind: SystemNodeKind;
  readonly description: string;
  readonly technology?: string;
}

export interface RuntimeConnection {
  readonly id: EntityId;
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly kind: RuntimeConnectionKind;
  readonly protocol: RuntimeProtocol;
  readonly label?: string;
}

export interface InternalArchitecture {
  readonly serviceId: EntityId;
  readonly units: readonly CodeUnit[];
  readonly dependencies: readonly StaticDependency[];
}

export interface CodeUnit {
  readonly id: EntityId;
  readonly name: string;
  readonly kind: CodeUnitKind;
  readonly layer: CodeLayer;
  readonly description: string;
}

export interface StaticDependency {
  readonly id: EntityId;
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly kind: StaticDependencyKind;
  readonly label?: string;
}

export interface BoundaryBinding {
  readonly id: EntityId;
  readonly serviceId: EntityId;
  readonly runtimeConnectionId: EntityId;
  readonly adapterUnitId: EntityId;
}

export interface ProjectedEndpoint {
  readonly runtimeConnectionId: EntityId;
  readonly serviceId: EntityId;
  readonly direction: 'inbound' | 'outbound';
  readonly peerNodeId: EntityId;
  readonly peerNodeName: string;
  readonly connectionKind: RuntimeConnectionKind;
  readonly protocol: RuntimeProtocol;
  readonly label?: string;
}

export type ViewScope =
  | { readonly level: 'system' }
  | { readonly level: 'internal'; readonly serviceId: EntityId };

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface ArchitectureView {
  readonly id: EntityId;
  readonly scope: ViewScope;
  readonly nodePositions: Record<EntityId, Point2D>;
}

export interface StructuralViolation {
  readonly code:
    | 'DUPLICATE_ID'
    | 'DUPLICATE_BINDING'
    | 'SELF_LOOP'
    | 'MISSING_REFERENCE'
    | 'INVALID_DRILLDOWN_TARGET'
    | 'VIEW_PARITY_MISMATCH'
    | 'INVALID_COORDINATE'
    | 'CARDINALITY_EXCEEDED'
    | 'NON_EMPTY_INTERNAL_ARCHITECTURE';
  readonly message: string;
  readonly entityId?: EntityId;
}

export type DomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly violations: readonly StructuralViolation[] };
```

#### Separação de `persistedRevision` e `mutationSeq`

`ArchitectureProject` **não** contém contador de revisão de banco. O controle de concorrência vive estritamente fora dos snapshots de Undo/Redo:
*   **`persistedRevision` (envelope do IndexedDB):** armazenado em `StoredProjectRecord { id, schemaVersion: 1, persistedRevision, savedAt, project }`. Incrementa exclusivamente dentro da transação atômica de `ProjectRepository.save(project, expectedRevision: number | null)`. Na sessão em memória, a camada de aplicação rastreia `lastPersistedRevision: number | null` (nunca revertido por `Undo`/`Redo`).
*   **`mutationSeq` (sessão em memória):** inteiro monotônico incrementado em todo comando editável — incluindo `undo()`, `redo()` e `applyViewLayout()` — usado exclusivamente para invalidar resultados atrasados de layout.

#### Regras de Drill-Down, Defaults de Camada e Projeção de Fronteira

*   **Elegibilidade para drill-down:** no MVP, apenas nós com `kind === 'service'` aceitam arquitetura interna (`InternalArchitecture` e `ArchitectureView` canônica criadas sob demanda na primeira entrada). Demais tipos (`client`, `gateway`, `database`, `cache`, `broker`, `external-system`) são nós terminais no MVP.
*   **Camada padrão derivada de `CodeUnitKind` (reduzindo atrito de criação):**
    *   `inbound-adapter`, `outbound-adapter` → `adapters`
    *   `use-case` → `application`
    *   `domain-service`, `domain-entity` → `domain`
    *   `interface` → `application` (editável pelo usuário para `domain` quando representar contrato de domínio)
*   **Projeção derivada de `Endpoint`s (`src/domain/projection.ts`):** para um serviço `S`, `deriveProjectedEndpoints(project, S.id)` deriva deterministicamente os `ProjectedEndpoint`s ordenados por `(direction, runtimeConnectionId)`:
    *   `direction: 'inbound'` para toda `RuntimeConnection` com `targetId === S.id`.
    *   `direction: 'outbound'` para toda `RuntimeConnection` com `sourceId === S.id`.
*   **Cardinalidade de `BoundaryBinding`:** **M:N** (um `Endpoint` externo pode vincular-se a múltiplos adaptadores — ex.: múltiplos repositórios compartilhando a conexão com `PostgreSQL` — e um adaptador pode vincular-se a múltiplos `Endpoint`s), com unicidade estrita da tupla `(serviceId, runtimeConnectionId, adapterUnitId)`. Sem inferência automática de adaptadores internos.

#### Ciclo de Vida do `Boundary Binding` (Vínculo Direto com Remoção em Cascata)

| Mutação no Modelo | Comportamento Determinístico Atômico | Diagnóstico Resultante |
| :--- | :--- | :--- |
| **Renomear nó vizinho** ou alterar `protocol`/`kind`/`label` da `RuntimeConnection` | `ProjectedEndpoint` reflete a mudança automaticamente via `runtimeConnectionId`. `BoundaryBinding` permanece íntegro. | Validadores reavaliam compatibilidade semântica normalmente. |
| **Reconectar ponta** (`reconnectRuntimeConnection(id, { sourceId?, targetId? })`) | Se o serviço `S` continuar sendo uma das pontas da conexão, `runtimeConnectionId` e os `BoundaryBinding`s de `S` são preservados. Se `S` deixar de incidir na conexão, os `BoundaryBinding`s de `S` para essa conexão são removidos em cascata. | `BOUNDARY_DIRECTION_MISMATCH` (`error`) se a direção derivada inverter frente ao tipo do adaptador; `UNBOUND_ADAPTER` (`warning`) se removido. |
| **Inverter direção** (`sourceId <-> targetId`) de uma `RuntimeConnection` | `BoundaryBinding` permanece ligado ao `runtimeConnectionId`, mas a direção derivada da conexão inverte. | `BOUNDARY_DIRECTION_MISMATCH` (`error`) ao comparar `adapterUnit.kind` com a nova direção derivada. |
| **Excluir `RuntimeConnection`** na topologia | Remove atomicamente a conexão e todos os `BoundaryBinding`s com aquele `runtimeConnectionId`. O adaptador interno permanece intacto. Um único `Ctrl+Z` restaura conexão e vínculos no snapshot anterior. | Adaptador interno remanescente recebe `UNBOUND_ADAPTER` (`warning`). |
| **Excluir `CodeUnit` (adaptador)** no nível interno | Remove atomicamente o `CodeUnit`, suas dependências `StaticDependency`, seus `BoundaryBinding`s e sua entrada `view.nodePositions[unitId]`. A conexão externa permanece intacta. | Conexão externa sem vínculo recebe `UNBOUND_EXTERNAL_ENDPOINT` (`warning`) se `internals[serviceId].units.length > 0`. |
| **Excluir `SystemNode`** na topologia | Remove atomicamente o nó, `systemView.nodePositions[nodeId]`, todas as conexões `RuntimeConnection` incidentes, `internals[nodeId]` (se serviço), sua `ArchitectureView` interna e todos os `BoundaryBinding`s associados às conexões removidas (inclusive em serviços vizinhos). | Adaptadores de serviços vizinhos que perderam conexão reportam `UNBOUND_ADAPTER` (`warning`). |
| **Alterar `SystemNode.kind`** de `'service'` para tipo terminal | Rejeitado por `NON_EMPTY_INTERNAL_ARCHITECTURE` enquanto `internals[id].units.length > 0`. Se o usuário confirmar limpeza explícita (`clearInternalArchitectureAndChangeKind`), remove atomicamente `internals[id]`, visão interna e bindings em 1 operação reversível por 1 `Ctrl+Z`. | Sem dados órfãos; `Ctrl+Z` restaura serviço e arquitetura interna intactos. |

---

### 4. Motor de Validação Determinística: Invariantes vs. Diagnósticos

#### Camada 1 — Invariantes Estruturais Bloqueantes (`src/domain/invariants.ts`)

Executados em todo comando de `src/domain/commands.ts` (retornando `DomainResult<ArchitectureProject>`), na Etapa 4 do pipeline de importação e em modo de desenvolvimento após commits. Falhas rejeitam a operação sem alterar estado persistido:

1.  **Unicidade:** IDs únicos em nós, conexões, unidades internas, dependências, bindings e visões; unicidade da tupla `(serviceId, runtimeConnectionId, adapterUnitId)` em `bindings`.
2.  **Sem auto-referência:** toda `RuntimeConnection` e `StaticDependency` satisfaz `sourceId !== targetId`.
3.  **Integridade referencial e paridade de visões:**
    *   `RuntimeConnection.sourceId` e `targetId` existem em `topology.nodes`.
    *   Cada chave `serviceId` em `internals` satisfaz `internals[serviceId].serviceId === serviceId` e referencia um `SystemNode` existente com `kind === 'service'`.
    *   Toda `StaticDependency` dentro de `internals[serviceId]` referencia `CodeUnit`s existentes daquele mesmo serviço.
    *   Todo `BoundaryBinding` referencia um `serviceId` com `internals[serviceId]` existente, uma `RuntimeConnection` existente incidente a `serviceId` e um `adapterUnitId` existente em `internals[serviceId].units`.
    *   Existe exatamente 1 visão com `scope.level === 'system'` e correspondência 1:1 entre chaves de `internals` e visões com `scope.level === 'internal'`.
    *   Toda chave de `view.nodePositions` corresponde exatamente a um elemento existente naquele escopo, todo elemento do escopo possui coordenada válida (`Number.isFinite(x) && Number.isFinite(y)`).
4.  **Isolamento de nível:** conexões de runtime só referenciam `SystemNode`; dependências estáticas só referenciam `CodeUnit` do mesmo serviço.
5.  **Limites de cardinalidade (`src/domain/limits.ts`):** `totalNodes <= 1_000`, `totalEdges <= 3_000`, `bindings <= 3_000`, `services <= 200`, `views <= 201` (até 200 visões internas + 1 visão `system`).

#### Camada 2 — Validadores Arquiteturais Determinísticos Não Bloqueantes (`src/rules/`)

Executados de forma pura sobre `ArchitectureProject` com debounce de 200 ms apenas após mutações semânticas (`changedSemantically === true`, nunca durante arraste visual). Regras de Nível 1 rodam sempre; regras de Nível 2 e cross-level rodam para cada serviço com `internals[serviceId].units.length > 0`.

**Matriz 3×3 completa de `LAYER_VIOLATION` (avalia arestas `depends-on` e `implements`):**

| Perfil | `adapters → adapters` | `adapters → application` | `adapters → domain` | `application → adapters` | `application → application` | `application → domain` | `domain → adapters` | `domain → application` | `domain → domain` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`hexagonal`** | Permitido | Permitido | Permitido | **Erro** | Permitido | Permitido | **Erro** | **Erro** | Permitido |
| **`layered`** | Permitido | Permitido | **Erro** (salto) | **Erro** | Permitido | Permitido | **Erro** | **Erro** | Permitido |
| **`distributed-baseline`** | Desativada | Desativada | Desativada | Desativada | Desativada | Desativada | Desativada | Desativada | Desativada |

*(Nota: em `hexagonal`, um adaptador em `adapters` pode implementar (`implements`) uma `Interface` em `application` ou `domain`; o sentido inverso `domain/application → adapters` é sempre `LAYER_VIOLATION`.)*

**Catálogo fechado das 9 regras determinísticas:**

| `ruleId` | `Diagnostic.scope` | Severidade | Regra Determinística | Evidência (`evidence`) |
| :--- | :--- | :--- | :--- | :--- |
| `LAYER_VIOLATION` | `{ level: 'internal', serviceId }` | `error` | Valida toda `StaticDependency` (`depends-on` e `implements`) contra a matriz 3×3 do `project.ruleProfile`. Inclui `dependencyId` em `targets`. | `{ dependencyId, sourceLayer, targetLayer, dependencyKind, profile }` |
| `STATIC_DEPENDENCY_CYCLE` | `{ level: 'internal', serviceId }` | `error` | Detecta componentes fortemente conexos com tamanho >= 2 via Tarjan $O(V + E)$ sobre arestas `depends-on` e `implements` dentro do serviço. | `{ cycleUnitIds: string[] }` |
| `DISTRIBUTED_DEPENDENCY_CYCLE` | `{ level: 'system' }` | `warning` | Detecta ciclos via Tarjan $O(V + E)$ sobre conexões síncronas (`sync-call`) na topologia. | `{ cycleNodeIds: string[] }` |
| `UNIMPLEMENTED_INTERFACE` | `{ level: 'internal', serviceId }` | `error` (`hexagonal`) / `warning` (`layered`, `distributed-baseline`) | Sinaliza `CodeUnit` com `kind: 'interface'` sem nenhuma aresta `implements` apontando para ele. | `{ interfaceUnitId }` |
| `INVALID_IMPLEMENTS_TARGET` | `{ level: 'internal', serviceId }` | `error` | Sinaliza aresta `implements` cujo `targetId` não possui `kind: 'interface'`. Inclui `dependencyId` em `targets`. | `{ dependencyId, targetKind }` |
| `INCOMPATIBLE_RUNTIME_CONNECTION` | `{ level: 'system' }` | `error` / `warning` | Verifica matriz semântica de Nível 1 (incluindo `connectionId` em `targets`): (1) `client → database` ou `client → cache` (`error`); (2) `database` ou `cache` como `source` de qualquer conexão (`error`); (3) `data-access` com `target.kind !== 'database'` (`error`); (4) `cache-access` com `target.kind !== 'cache'` (`error`); (5) `async-publish` com `target.kind !== 'broker'` (`error`); (6) `async-consume` com `source.kind !== 'broker'` (`error`); (7) `service → client` com `sync-call` (`warning`); (8) protocolo incompatível com `connectionKind` (`sql` só em `data-access`, `redis` só em `cache-access`, `amqp`/`kafka` só em `async-*`; `custom` aceito em todos — `warning`). | `{ connectionId, sourceKind, targetKind, connectionKind, protocol, reason }` |
| `UNBOUND_EXTERNAL_ENDPOINT` | `{ level: 'internal', serviceId }` | `warning` | Serviço com `internals[serviceId].units.length > 0` possui `RuntimeConnection` incidente sem nenhum `BoundaryBinding` vinculado. Inclui `runtimeConnectionId` em `targets`. | `{ serviceId, runtimeConnectionId, direction }` |
| `UNBOUND_ADAPTER` | `{ level: 'internal', serviceId }` | `warning` | `CodeUnit` com `kind: 'inbound-adapter'` ou `'outbound-adapter'` dentro do serviço não possui nenhum `BoundaryBinding`. | `{ serviceId, adapterUnitId, adapterKind }` |
| `BOUNDARY_DIRECTION_MISMATCH` | `{ level: 'internal', serviceId }` | `error` | `BoundaryBinding` vincula `inbound-adapter` a conexão cuja direção derivada é `outbound`, ou `outbound-adapter` a conexão `inbound`, ou vincula `CodeUnit` cujo `kind` não é adaptador de borda. Inclui `bindingId` em `targets`. | `{ bindingId, adapterKind, derivedDirection }` |

**Contrato `Diagnostic`:**

```ts
export type DiagnosticSeverity = 'error' | 'warning';

export interface DiagnosticTarget {
  readonly kind: 'system-node' | 'runtime-connection' | 'code-unit' | 'static-dependency' | 'boundary-binding';
  readonly id: EntityId;
}

export interface Diagnostic {
  readonly id: string; // `${ruleId}:${scopeKey}:${sortedTargetIds.join(',')}`
  readonly ruleId: string;
  readonly severity: DiagnosticSeverity;
  readonly scope: ViewScope;
  readonly title: string;
  readonly message: string;
  readonly suggestion: string;
  readonly targets: readonly DiagnosticTarget[];
  readonly evidence: Record<string, unknown>;
}
```

*   `scopeKey` é `'system'` ou `` `internal:${scope.serviceId}` ``.
*   `sortedTargetIds` ordena lexicograficamente `${target.kind}:${target.id}` separados por `,`.
*   Lista final ordenada por severidade (`error` antes de `warning`), depois `ruleId` lexicográfico e desempate final por `id` lexicográfico.

---

### 5. Fluxo Unidirecional de Estado, Canvas, Undo/Redo e Layout

```text
[Interação no Canvas (@xyflow/vue v2 dentro de <VueFlowProvider>)]
   |-- frame de arraste / seleção / pan-zoom --> buffer local shallowRef no VueFlowDiagramAdapter
   |     (@nodes-change + applyNodeChanges; trava isDragging bloqueia overwrite de validação)
   |     (sem mutação de domínio, sem entrada no Undo/Redo e sem gravação no IndexedDB)
   |
   +-- evento confirmado (node-drag-stop, connect, edit, delete, layout, bind)
          |
          v
[src/application/ (Use Cases — TypeScript puro, zero Vue/DOM)]
   1. Executa comando puro em src/domain/commands.ts -> DomainResult<ArchitectureProject>
   2. Se ok: empilha snapshot anterior no SnapshotHistory (máx. 50, array TS puro)
   3. Incrementa mutationSeq monotônico (fora do snapshot)
   4. Retorna { project, changedSemantically, canUndo, canRedo, mutationSeq }
          |
          v
[src/ui/composables/useWorkspace.ts (Vue composable com shallowRef — sem Pinia)]
   1. Atualiza shallowRef<ArchitectureProject | null>
   2. Se changedSemantically: agenda evaluateProject(project) (debounce 200 ms)
   3. Agenda autosave em fila serializada single-flight via ProjectRepository (debounce 600 ms)
   4. Mantém câmera efêmera de sessão por (projectId, scopeKey) fora do domínio
          |
          v
[Projeção Pura (src/diagram-adapter/projection.ts) -> VueFlowDiagramAdapter -> :nodes / :edges]
```

*   **Composable `VueFlowDiagramAdapter` (`src/diagram-adapter/useVueFlowAdapter.ts`):** executado dentro do `setup()` de `ArchitectureCanvas.vue` sob `<VueFlowProvider>` para acessar `useVueFlow()` (`getInternalNode(id)?.measured`, `fitView`) sem erro de `provide/inject`. Recebe `DiagramViewModel` projetado e sincroniza o buffer local `shallowRef` exceto enquanto `isDragging === true`. `@xyflow/vue/style.css` é importado em `src/main.ts`.
*   **Undo/Redo:** `SnapshotHistory` vive na camada `src/application/` com limite exato de **50 snapshots** imutáveis de `ArchitectureProject` em memória, acessado via casos de uso explícitos `undo()` e `redo()`. Desfazer ou refazer restaura `ArchitectureProject`, incrementa `mutationSeq` e **preserva `lastPersistedRevision`** para evitar falsos conflitos no IndexedDB.
*   **Layout Automático sob Demanda (`LayoutPort`):**
    *   Contrato explícito em `src/application/ports/LayoutPort.ts`:
        ```ts
        export interface LayoutGraphInput {
          readonly nodes: readonly { readonly id: EntityId; readonly width: number; readonly height: number }[];
          readonly edges: readonly { readonly sourceId: EntityId; readonly targetId: EntityId }[];
        }
        export interface LayoutGraphOutput {
          readonly positions: Record<EntityId, Point2D>;
        }
        export interface LayoutPort {
          computeLayout(input: LayoutGraphInput, signal?: AbortSignal): Promise<LayoutGraphOutput>;
        }
        ```
    *   Dimensões vêm de `getInternalNode(id)?.measured` com fallback determinístico (`width: 220, height: 84`).
    *   `applyViewLayout` captura `baseMutationSeq = session.mutationSeq` e `baseScope = activeScope` antes de chamar `LayoutPort.computeLayout(...)`; se `mutationSeq` ou `activeScope` mudou durante o cálculo, o resultado atrasado é descartado sem alterar a visão ativa. Se válido, aplica as posições em 1 único commit no `SnapshotHistory` (`changedSemantically: false`).

---

### 6. Persistência Local-First, Schema JSON `v1`, Segurança e Diagnóstico Local

#### Schema JSON `v1` (`src/schemas/projectFileV1.ts`)

```ts
export const CURRENT_SCHEMA_VERSION = 1 as const;

export interface ProjectFileDtoV1 {
  readonly schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  readonly exportedAt?: string;
  readonly project: ArchitectureProject;
}
```

*   **Zod `^4.3.0`:** fixado em `package.json`; todos os objetos usam `z.strictObject(...)` com `.exactOptional()` nos campos opcionais para compatibilidade com `exactOptionalPropertyTypes: true`; erros formatados com `z.flattenError()` para mensagens legíveis ao usuário.
*   **Regras de segurança no schema:**
    *   `EntityId`: regex `^[a-zA-Z0-9_-]{1,64}$` rejeitando explicitamente `__proto__`, `constructor`, `prototype` e `toString` (e lookups em dicionários usando `Object.hasOwn`).
    *   Limites de string: `name` (`1..120` após `trim()`), `label` (`<= 120`), `technology` (`<= 80`), `description` (`<= 4000`).
    *   Coordenadas `x`, `y`: `z.number().finite()`.
    *   `vue/no-v-html` habilitado no ESLint (proibindo injeção de HTML).
*   **Serialização determinística:** na exportação JSON, coleções (`nodes`, `connections`, `units`, `dependencies`, `bindings`, `views`) e chaves de dicionários (`internals`, `nodePositions`) são ordenadas lexicograficamente por `id`.

#### Pipeline de Importação Segura em 4 Etapas (`src/application/use-cases/importExportProject.ts`)

Recebe `ImportFileSource = { readonly fileName: string; readonly byteLength: number; readText(): Promise<string> }` (sem API `File` do navegador em `src/application/`):

1.  **Validação pré-leitura:** verifica extensão `.json` e `byteLength <= 5_242_880` bytes (5 MB) antes de ler texto ou executar `JSON.parse()`.
2.  **Parse e portão de versão:** executa `JSON.parse()` protegido em `try/catch`; verifica `schemaVersion` inteiro (rejeita `> 1` com `UNSUPPORTED_FUTURE_VERSION` e demais valores com `INVALID_SCHEMA_VERSION`, sem carregamento parcial).
3.  **Schema estrito (Zod `^4.3.0`):** valida integralmente contra `ProjectFileDtoV1Schema`.
4.  **Integridade referencial e resolução de conflito de ID:** executa `validateStructuralInvariants(project)` em memória. Somente após passar grava no IndexedDB. Se `project.id` já existir localmente, a UI solicita escolha explícita:
    *   **Importar como cópia:** gera novo `project.id`, acrescenta sufixo `" (Cópia)"` ao `name`, atualiza `createdAt`/`updatedAt` e grava com `expectedRevision = null`.
    *   **Substituir projeto existente:** lê a revisão atual no repositório e grava atomicamente com `expectedRevision = existing.persistedRevision` (avançando para `existing.persistedRevision + 1`).

#### Armazenamento IndexedDB (`src/storage/IndexedDBProjectRepository.ts` via `idb`)

*   **Banco `flow-forge-db` (versão 1) — 1 store atômica `projects` (`keyPath: 'id'`):** armazena `StoredProjectRecord { id, schemaVersion: 1, persistedRevision, savedAt, project }`.
*   **Compare-and-Swap (CAS) em transação única `readwrite`:** `save(project, expectedRevision)` executa `store.get(project.id)` -> verifica `expectedRevision` -> `store.put(nextRecord)` dentro da **mesma** transação `readwrite` sem `await` externo no meio:
    *   Criação (`expectedRevision === null`): exige `!stored`, grava `persistedRevision = 1`.
    *   Atualização (`expectedRevision !== null`): se `!stored` (exclusão externa em outra aba) ou `stored.persistedRevision !== expectedRevision`, aborta a transação e lança `RevisionConflictError`. Caso contrário, grava `persistedRevision = expectedRevision + 1` e retorna o novo número.
*   **Fila serializada (*single-flight*) e proteção contra perda:** `useWorkspace.ts` serializa gravações (1 `save` em voo por vez, coalescendo alterações pendentes), aguarda `flush()` antes de trocar de projeto ou exportar e ativa `beforeunload` enquanto houver estado *dirty*.
*   **Recuperação de falhas e testes:** `navigator.storage?.persist?.()` é chamado sob guarda de ambiente (`typeof navigator !== 'undefined'`). Falhas de `QuotaExceededError`, erro transacional ou `RevisionConflictError` preservam o projeto em memória e exibem banner com ações imediatas **"Recarregar do IndexedDB"** e **"Baixar JSON da memória"**. `ProjectRepository` expõe `close()` para teardown limpo no Vitest.

#### Diagnóstico Local Mínimo (`src/ui/diagnostics/localDiagnosticLog.ts`)

Utilitário enxuto na borda de UI (~30 linhas) mantendo ring-buffer em memória de 200 eventos estruturados (`timestamp`, `category`, `code`, `durationMs`, contagens numéricas — omitindo nomes, descrições e rótulos definidos pelo usuário). Exportável em JSON pelo menu superior com checkbox opt-in explícito para anexar o projeto atual. Em `import.meta.env.DEV` e testes, um guardião de desenvolvimento valida `validateStructuralInvariants(project)` e testa clonabilidade sem Proxies via `structuredClone(project)` (capturando Proxies em qualquer profundidade sem importar `vue` no domínio).

---

### 7. Portão Técnico Pré-Implementação — Spike Técnica Descartável (Fatia 0)

Executada em diretório/branch descartável fora da árvore de produção, com evidências registradas em `docs/validation/spike-0-report.md`. **Não autoriza início da implementação do MVP sem aprovação explícita do autor.**

| Critério Verificado na Spike | Meta Mensurável (`Go`) | Gatilho Objetivo de Pivot |
| :--- | :--- | :--- |
| **Nós customizados, handles e setas diferenciadas** | Nós de Nível 1 e Nível 2 renderizam com badges de `Boundary Binding`, estilos distintos (síncrono/assíncrono/estático) e zero sobreposição de rótulos/caixas. | Bug bloqueante na API de handles/edges do `@xyflow/vue` v2.0.0 sem contorno suportado. |
| **Fluxo unidirecional + drill-down** | `@nodes-change` + `applyNodeChanges` em buffer `shallowRef` com trava `isDragging` mantém arraste sem loops de re-render e grava posição somente em `node-drag-stop`; alternância Nível 1 <-> Nível 2 preserva posições. | Perda de estado interno do `@xyflow/vue` v2 ou loop de re-render ao alternar escopos. |
| **Serialização e tipagem estrita** | Zero `DataCloneError` em `structuredClone` / `idb.put` após ciclo de edição Vue; `vue-tsc --noEmit` passa com `exactOptionalPropertyTypes: true` (ou confirma necessidade de isolar a flag em `tsconfig.core.json`). | Vazamento inevitável de Proxy pelas APIs da biblioteca. |
| **Seleção de layout em `vite build` + `vite preview`** | Testar primeiro `@dagrejs/dagre` (ou `elkjs` sem Worker): aprovação se layout executar em `<= 150 ms` (50 nós) e `<= 500 ms` (300 nós) com zero sobreposição. | Se ultrapassar os limiares -> avaliar `elkjs` em Web Worker (`import('elkjs/lib/elk-api.js')` lazy + `elk-worker.min.js?url` `{ type: 'classic' }` + `webWorkerStub.ts` + timeout 5 s recriando instância `ELK`) garantindo ausência do motor no entry chunk. |
| **Estresse progressivo (50 / 150 / 300 nós)** | Arraste de nó e pan/zoom em 300 nós sem congelamento da main thread acima de 200 ms por gesto em hardware de desenvolvimento comum (sem exigir 60 FPS absolutos). | Travamento severo específico do wrapper Vue na faixa 150–300 nós -> executar teste comparativo idêntico com `@xyflow/react` antes de decidir pivot. |

---

## Alternatives Considered

### Alternative A: Monorepo multipacotes (`architecture-core`, `architecture-rules`, `diagram-adapter`, `project-storage`, `shared-schemas`)

*   **Pros:** fronteiras físicas de pacote desde o início e publicação independente facilitada.
*   **Cons:** overhead imediato de workspaces, `tsconfig` project references, `exports` em cinco manifestos, HMR mais lento e atrito em refatorações enquanto o metamodelo estabiliza, sem segundo consumidor real no MVP.
*   **Reason for Rejection:** Substituído por monólito modular em projeto único Vite + TypeScript com `dependency-cruiser` em CI impondo exatamente as mesmas fronteiras hexagonais. Extração física adiada até existir segundo consumidor (CLI ou backend).

### Alternative B: Rete.js v2 como motor de editor visual

*   **Pros:** núcleo agnóstico de framework e sockets fortemente tipados para fluxo de dados.
*   **Cons:** voltado a programação visual de *dataflow*; exige compor múltiplos plugins (`area`, `vue`, `connection`, `scopes`) e aumenta o esforço de adaptação para diagramas arquiteturais multinível com layout estrutural.
*   **Reason for Rejection:** Incompatibilidade técnica de paradigma frente à família `@xyflow`.

### Alternative C: `@xyflow/react` (React Flow) em vez de `@xyflow/vue` v2

*   **Pros:** maior volume histórico de exemplos comunitários e tempo de campo em produção dentro da família `xyflow`.
*   **Cons:** descarta a familiaridade prévia com Vue 3 + TypeScript mesmo após `@xyflow/vue` v2.0.0 unificar o núcleo `@xyflow/system`.
*   **Reason for Rejection:** Mantido como plano de contingência restrito ao portão da Fatia 0 (antes de iniciar `src/ui/`), condicionado a evidência objetiva de bloqueio no `@xyflow/vue` v2.

### Alternative D: Abstração universal única de `Port` e `Relationship` para todos os níveis

*   **Pros:** menor número inicial de tipos no schema.
*   **Cons:** mistura comunicação de rede em runtime com dependência estática de compilação, enfraquece invariantes, exige ramificações condicionais por nível nos validadores e gera inversão acidental de setas.
*   **Reason for Rejection:** Substituído pela separação explícita entre `DistributedTopology` e `InternalArchitecture` unidos por `BoundaryBinding`.

### Alternative E: `Endpoint` persistido como entidade intermediária ou `BoundaryBinding` com estado `orphaned`

*   **Pros:** um `Endpoint` persistido preserva vínculos se o usuário apagar e recriar uma conexão para outro alvo; um estado `orphaned` mantém rastro textual da conexão removida.
*   **Cons:** `Endpoint` persistido adiciona uma terceira entidade com ciclo de vida manual na topologia; estado `orphaned` quebra a integridade referencial estrita e exige limpeza manual recorrente.
*   **Reason for Rejection:** Substituído por vínculo direto a `RuntimeConnection` com remoção em cascata atômica (preservando integridade referencial estrita) combinado com o comando `reconnectRuntimeConnection`, que mantém `runtimeConnectionId` e bindings intactos ao trocar alvo externo.

### Alternative F: `ProjectedEndpoint` como nó posicionável no canvas (`endpointPositions` + `LayoutPort`)

*   **Pros:** mostra visualmente pontos de entrada/saída nas bordas do canvas do Nível 2.
*   **Cons:** espalha tratamento especial por `ArchitectureView`, `LayoutPort`, `VueFlowDiagramAdapter` e `ArchitectureCanvas`, recriando parte da complexidade de conectores configuráveis excluídos no MVP.
*   **Reason for Rejection:** Simplificado no MVP para seção fixa "Fronteira Externa" no `InspectorPanel` + badges contextuais nos adaptadores no canvas, preservando a possibilidade de evoluir para visualização no canvas sem carregar `endpointPositions` na `v1`.

### Alternative G: Inferência automática da arquitetura interna a partir da topologia externa

*   **Pros:** reduz cliques iniciais ao entrar pela primeira vez em um serviço.
*   **Cons:** oculta decisões de design, cria componentes fictícios não solicitados e gera conflitos de sincronização quando a topologia muda.
*   **Reason for Rejection:** Substituído por projeção somente-leitura de `Endpoint`s com `Boundary Binding` manual explícito e diagnósticos de divergência.

### Alternative H: Múltiplas visões parciais arbitrárias, grupos aninhados arrastáveis e `Handle`s configuráveis no MVP

*   **Pros:** maior flexibilidade visual já na primeira entrega.
*   **Cons:** introduz sincronização entre visões parciais, Model Explorer avançado, semântica dupla de exclusão ("remover da visão" vs. "excluir do modelo") e bugs de coordenadas relativas/redimensionamento em grupos aninhados.
*   **Reason for Rejection:** Adiado para etapas futuras; o MVP entrega 1 visão canônica por nível preservando `views[]` no schema `v1`.

### Alternative I: Adotar LikeC4 ou Structurizr em vez de construir o Flow-Forge

*   **Pros:** zero custo de desenvolvimento de editor visual; fonte única de verdade C4 já madura (incluindo validação em TypeScript/Vitest no LikeC4).
*   **Cons:** centrados em fluxo textual (*model-as-code* / DSL), não atendendo à exploração visual interativa com feedback determinístico imediato no canvas durante concepção.
*   **Reason for Rejection:** Não atendem ao modelo de interação visual-first do produto; mantidos como referência conceitual de separação entre modelo e visões.

### Alternative J: Sincronização bidirecional (`v-model:nodes`) entre `@xyflow/vue` e estado da aplicação

*   **Pros:** menor código inicial de ligação.
*   **Cons:** dispara mutações a cada frame de arraste, degrada responsividade, polui histórico de Undo/Redo e provoca `DataCloneError` com Proxies do Vue 3.
*   **Reason for Rejection:** Substituído por fluxo unidirecional com buffer local `shallowRef` via `@nodes-change` + `applyNodeChanges`.

### Alternative K: Pinia, `eslint-plugin-boundaries` + `dependency-cruiser` em paralelo e 5 portas formais

*   **Pros:** Pinia oferece integração nativa com Vue DevTools; duas ferramentas de fronteira entregam aviso inline na IDE além do CI; portas para ID/relógio/log seguem padronização uniforme.
*   **Cons:** para 1 único estado raso baseado em `shallowRef`, Pinia adiciona dependência de produção sem ganho prático; manter duas matrizes de fronteira duplica manutenção e gera risco de divergência; interfaces de método único para `crypto.randomUUID`, `Date` e ring-buffer criam boilerplate artificial sem múltiplas implementações reais.
*   **Reason for Rejection:** Substituído por composable Vue puro (`useWorkspace.ts`), `dependency-cruiser` como fonte única de verificação da ADR-001 em CI (com ESLint focado em qualidade e `vue/no-v-html`), 2 portas formais reais (`ProjectRepository`, `LayoutPort`) e funções injetáveis com default para ID/relógio.

### Alternative L: Infraestrutura de migrações (`migrations.ts`, `migration_backups`, `mapper.ts`) e `BroadcastChannel` na `v1`

*   **Pros:** prepara migração futura e antecipa aviso visual instantâneo entre duas abas abertas.
*   **Cons:** na `v1` inicial não existe versão anterior para migrar, gerando código morto, store extra, necessidade de UI/retenção de backups inacessíveis e duplicação de tipos idênticos; `BroadcastChannel` adiciona estado e listeners cross-tab redundantes quando o CAS transacional no IndexedDB já impede sobrescrita silenciosa.
*   **Reason for Rejection:** Adiados para quando existir `v2` (migrações/backups) ou necessidade real de colaboração local multi-aba (`BroadcastChannel`). Na `v1`, `schemaVersion === 1` estrito + CAS em transação única `readwrite` + download JSON de recuperação cobrem integralmente integridade e portabilidade.

### Alternative M: API crua do IndexedDB, Dexie ou `localStorage`, e Undo/Redo por comandos inversíveis

*   **Pros:** `localStorage` é trivial; Dexie oferece queries reativas; padrão Command reduz memória teórica em grafos gigantes.
*   **Cons:** `localStorage` é síncrono (~5 MB); API crua aumenta risco transacional; Dexie aumenta tamanho de bundle sem necessidade para gravação atômica por documento; escrever `undo()` inverso manual para cascatas multinível é propenso a bugs.
*   **Reason for Rejection:** Escolhidos `idb` atrás de `ProjectRepository` e 50 snapshots imutáveis em memória em `SnapshotHistory`.

---

## Risks & Mitigations

| Risco | Severidade | Mitigação Concreta no Design |
| :--- | :---: | :--- |
| **Raio de explosão do pivot `@xyflow/vue` → `@xyflow/react`** | Alto | Trocar Vue por React exige reescrever toda `src/ui/` e `src/diagram-adapter/`. Mitigado executando a Fatia 0 (spike descartável) **antes** de criar qualquer arquivo de `src/ui/`, fechando a decisão com métricas objetivas. |
| **Memória dos 50 snapshots no limite de cardinalidade (5 MB)** | Médio | Comandos de domínio usam *spread* imutável, compartilhando por referência todas as subárvores não alteradas (ex.: mover um nó não clona `topology`, `internals` nem `bindings`), mantendo o consumo de memória baixo sem adicionar bibliotecas externas. |
| **Evicção silenciosa de dados do IndexedDB pelo navegador** | Alto | Mesmo chamando `navigator.storage?.persist?.()`, navegadores podem negar persistência. Mitigado por indicador permanente de alterações não exportadas desde o último download JSON e exportação em 1 clique. |
| **Atrito de modelagem manual inviabilizar uso em *design review*** | Alto | Defaults automáticos de `layer` a partir de `kind`, consolidação em 3 camadas, `reconnectRuntimeConnection` preservando bindings e validação prática obrigatória em 2 sistemas reais anonimizados (`G8`) com critérios objetivos registrados. |
| **Quebra de `exactOptionalPropertyTypes: true` com `@xyflow/vue` v2 / Zod** | Médio | Fixado `zod ^4.3.0` (`.exactOptional()`) e verificação obrigatória na Fatia 0 com `vue-tsc --noEmit`; se o wrapper Vue conflitar, isolar `exactOptionalPropertyTypes: true` em `tsconfig.core.json` para `domain`/`rules`/`schemas`/`application`. |
| ***Architecture drift* entre modelo manual e código-fonte real** | Médio | Risco assumido fora do escopo do MVP; documentação e interface deixam explícito que a Etapa 1 valida o projeto arquitetural declarado, prevendo integração com repositórios na Etapa 4. |

---

## Non-Functional Requirements

*   **Segurança de Entrada e Integridade de Dados:**
    *   Nenhuma execução de código arbitrário, `eval`, scripts de usuário ou HTML não sanitizado (`vue/no-v-html` ativo no ESLint).
    *   Importação protegida em 4 etapas: extensão `.json` e tamanho `<= 5 MB` antes de `JSON.parse()`; `schemaVersion === 1` estrito (rejeitando versões futuras sem abertura parcial); Zod `^4.3.0` (`z.strictObject`, `.exactOptional()`, regex segura de `EntityId` bloqueando `__proto__`/`constructor`/`prototype`/`toString`, tetos de string e `Number.isFinite` em coordenadas); e integridade referencial completa (`<= 1.000` nós totais, `<= 3.000` arestas, `<= 3.000` bindings, `<= 200` serviços, `<= 201` visões).
*   **Desempenho e Responsividade no Navegador:**
    *   Suíte de validadores determinísticos executando em `< 50 ms` para modelos de 200 nós e 500 arestas (verificado por teste automatizado), usando Tarjan $O(V + E)$ e debounce de 200 ms apenas após mutações semânticas.
    *   Arraste e seleção isolados em estado efêmero do `diagram-adapter`, sem commits no domínio, validações ou escrita no IndexedDB durante movimento contínuo.
    *   Teste de estresse progressivo na Fatia 0 (50, 150 e 300 nós) sem congelamento da thread principal acima de 200 ms por gesto.
*   **Persistência, Recuperação e Migração Futura:**
    *   Gravação atômica por projeto em transação única `readwrite` no IndexedDB (`idb`) com checagem CAS de `persistedRevision`, fila *single-flight* de autosave (debounce 600 ms) com `flush()` ao trocar/fechar projeto e aviso `beforeunload`.
    *   Banner de recuperação imediata ("Recarregar do IndexedDB" ou "Baixar JSON da memória") em `QuotaExceededError`, erro transacional ou `RevisionConflictError` (incluindo exclusão externa).
    *   Exportação JSON determinística com ordenação por `id` para diffs limpos em Git; suporte a migrações lineares + backup pré-migração previsto apenas quando existir `schemaVersion: 2`.
*   **Observabilidade Local e Manutenibilidade:**
    *   Ring-buffer local de 200 eventos estruturados na borda de UI (sem dados autorais do usuário no log padrão; exportável com opt-in explícito para anexar o projeto) e verificação recursiva de invariantes + `structuredClone` em modo de desenvolvimento.
    *   Fronteiras da ADR-001 verificadas automaticamente em CI por `dependency-cruiser` (cobrindo `.ts` e `.vue`).
    *   Modelos de exemplo e os 2 sistemas reais anonimizados versionados no schema `v1` e verificados automaticamente nos testes.

---

## Additional Resources

*   [concepts_brief.md](../../concepts_brief.md) — Brief consolidado da fase de descoberta e escopo do MVP.
*   Vue Flow / `@xyflow/vue` v2 (`@xyflow/system`): https://vueflow.dev/ e https://github.com/xyflow/xyflow
*   ELK.js (`elkjs`) e `@dagrejs/dagre`: https://github.com/kieler/elkjs e https://github.com/dagrejs/dagre
*   Zod v4: https://zod.dev/
*   `idb` (IndexedDB wrapper): https://github.com/jakearchibald/idb
*   `dependency-cruiser`: https://github.com/sverweij/dependency-cruiser
*   Referências conceituais: C4 Model / Structurizr (https://c4model.com/), LikeC4 (https://likec4.dev/) e ArchUnit (https://www.archunit.org/).

## Future Improvements

*   **Etapa 2 — Fluxos de Execução:** cenários sequenciais e condicionais (caminhos alternativos, erros, retries, timeouts) referenciados sobre os IDs estáveis do núcleo `v1`.
*   **Etapa 3 — Simulação e Implantação:** motor de simulação discreta (latência, filas, cache hit/miss, falhas) atrás de uma futura `SimulationPort`, modelagem de ambientes/réplicas e eventual projeção visual de `Endpoint`s diretamente nas bordas do canvas.
*   **Etapa 4 — Integração com Código, Migrações e Colaboração:** análise de repositórios para detecção de *architecture drift*, CLI compartilhando `domain`/`rules` (gatilho para eventual extração em pacotes), perfis de regras por serviço, múltiplas visões parciais sobre `views[]`, pipeline `migrateV1ToV2` com backup pré-migração e backend opcional.

---

## Detailed Implementation Plan

A execução segue **1 portão pré-implementação (Fatia 0 — Spike Técnica Descartável)** e **5 fatias verticais incrementais**, cada uma deixando o repositório em estado compilável, verificável e testável. **Nenhuma fatia de produção (Fatias 1–5) inicia sem aprovação explícita do autor após revisão das evidências da Fatia 0.**

### Sequência Incremental e Checkpoints por Fatia

1.  **Fatia 0 — Spike Técnica Descartável (fora da árvore de produção):** executa os 5 testes da Seção 7 e registra evidências e decisão *Go / Pivot* (canvas e layout) em `docs/validation/spike-0-report.md`.
    *   *Checkpoint:* aprovação explícita do autor congelando adaptadores de canvas (`@xyflow/vue` v2 vs `@xyflow/react`) e layout (`@dagrejs/dagre` / `elkjs` direto vs `elkjs` Web Worker).
2.  **Fatia 1 — Fundação, Guardrails ADR-001, Domínio e Schemas:** cria configuração base, `.dependency-cruiser.cjs`, `docs/adr/ADR-001-dependency-inversion-ports-adapters.md`, `src/domain/`, `src/schemas/` e testes unitários em Node puro.
    *   *Checkpoint:* `npm run typecheck`, `npm run lint`, `npm run depcruise`, `npm run test:unit` (verde).
3.  **Fatia 2 — Motor de Validadores Determinísticos e 2 Exemplos Base:** implementa `src/rules/`, `src/examples/` (2 exemplos base: válido e defeituoso) e testes unitários validando todas as 9 regras e a meta `< 50 ms`.
    *   *Checkpoint:* `npm run typecheck`, `npm run lint`, `npm run depcruise`, `npm run test:unit` (incluindo regressão dos 2 exemplos base via `schemas` + `invariants` + `rules`).
4.  **Fatia 3 — Casos de Uso, Undo/Redo, Persistência IndexedDB e Integração de Storage:** implementa `src/application/`, `src/storage/`, fakes de teste e testes unitários + `integration-storage` (`fake-indexeddb`). Ativa `test:integration` no `ci.yml`.
    *   *Checkpoint:* `npm run typecheck`, `npm run lint`, `npm run depcruise`, `npm run test:unit`, `npm run test:integration` (storage), `npm run test:coverage` (limiares em `domain`/`rules`/`application`).
5.  **Fatia 4 — Adaptador de Diagrama, Layout sob Demanda, Composition Root e Interface Vue 3:** *(arquivos específicos de borda confirmados após Fatia 0)* implementa `index.html`, `src/main.ts`, `src/styles/base.css`, `src/layout/`, `src/diagram-adapter/`, `src/composition/createAppContainer.ts`, `src/ui/` e testes `integration-diagram` (`happy-dom`). Ativa `build` no `ci.yml`.
    *   *Checkpoint:* `npm run typecheck`, `npm run lint`, `npm run depcruise`, `npm run test:unit`, `npm run test:integration`, `npm run test:coverage`, `npm run build`.
6.  **Fatia 5 — Testes E2E e Validação Prática em 2 Sistemas Reais Anonimizados (`G8`):** implementa `tests/e2e/flowForge.spec.ts`, modela os 2 sistemas reais anonimizados em `src/examples/` (ampliando `examplesIntegrity.spec.ts` para 4 modelos), redige `docs/validation/real-systems-evaluation.md` e ativa `test:e2e` no `ci.yml`.
    *   *Checkpoint:* pipeline completo de CI verde (`typecheck`, `lint`, `depcruise`, `test:coverage`, `test:integration`, `build`, `test:e2e`) + revisão dos 2 modelos reais e relatório `G8`.

### Contratos de Aplicação, Defaults de UI e `AppContainer`

*   **Comandos de `src/domain/commands.ts`:** funções puras recebendo `(project: ArchitectureProject, payload, nowIso: string, nextId?: () => string): DomainResult<ArchitectureProject>`: `addSystemNode`, `updateSystemNode`, `changeSystemNodeKind`, `clearInternalArchitectureAndChangeKind`, `deleteSystemNode`, `addRuntimeConnection`, `updateRuntimeConnection`, `reconnectRuntimeConnection`, `deleteRuntimeConnection`, `ensureInternalArchitecture`, `addCodeUnit`, `updateCodeUnit`, `deleteCodeUnit`, `addStaticDependency`, `updateStaticDependency`, `deleteStaticDependency`, `addBoundaryBinding`, `deleteBoundaryBinding`, `setRuleProfile`, `updateViewNodePositions`.
*   **Retorno de `ProjectRepository.load(id)`:** `Promise<StoredProjectRecord | null>` contendo `{ id, schemaVersion: 1, persistedRevision, savedAt, project }`; `listSummaries()` retorna `Promise<readonly ProjectSummary[]>` (`{ id, name, updatedAt, persistedRevision }`).
*   **Contrato de `AppContainer` (`src/composition/createAppContainer.ts`):** expõe `{ projectRepo, layoutPort, createProject, openProject, saveProject, deleteProject, listProjects, createProjectFromExample, editProject, undo, redo, getHistoryState, importProject, exportProject, applyViewLayout }` e aceita overrides parciais (`Partial<AppContainerDeps>`) para testes de integração.
*   **Valores padrão na interface:**
    *   Projeto novo (`createProject`): `ruleProfile = 'hexagonal'`, visão inicial `system` vazia.
    *   Tela inicial com IndexedDB vazio (`App.vue`): exibe estado vazio com ações diretas "Novo Projeto" e "Abrir Exemplo (Pedidos Hexagonal)".
    *   Novo nó no Nível 1: nome padrão `"Novo <Tipo>"`, posicionado em grade livre próxima ao centro do viewport.
    *   Nova conexão no Nível 1: `kind = 'sync-call'`, `protocol = 'http'` (ajustado automaticamente para `data-access`/`sql` quando `target` é `database`, `cache-access`/`redis` quando `target` é `cache`, `async-publish`/`kafka` quando `target` é `broker`, e `async-consume`/`kafka` quando `source` é `broker`).
    *   Novo `CodeUnit` no Nível 2: `layer` inicial derivada de `kind` (Seção 3).
    *   Nova aresta no Nível 2: `kind = 'depends-on'` (ou `'implements'` quando o usuário seleciona no inspetor / arrasta de adaptador para `interface` com toggle).
    *   Atalhos globais (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Delete`/`Backspace`): ignorados sempre que `document.activeElement` for `INPUT`, `TEXTAREA`, `SELECT` ou `contentEditable`.

---

### Target Files to Create/Modify

#### Configuração, Documentação e Guardrails de CI

##### 1. `package.json` (Create — `[Fatia 1]`)

*   **Type / Scope**: Build & Dependency Configuration
*   **Proposed Changes**: Define scripts (`dev`, `build`, `preview`, `typecheck` como `vue-tsc --noEmit`, `lint`, `depcruise`, `test:unit`, `test:integration`, `test:coverage`, `test:e2e`), dependências de produção (`vue`, `@xyflow/vue` `^2.0.0`, `zod` `^4.3.0`, `idb`, `@dagrejs/dagre` — ou `elkjs` conforme Fatia 0) e desenvolvimento (`typescript`, `vue-tsc`, `vite`, `@vitejs/plugin-vue`, `@vue/compiler-sfc`, `vitest`, `@vitest/coverage-v8`, `fake-indexeddb`, `happy-dom`, `@vue/test-utils`, `@playwright/test`, `eslint`, `typescript-eslint`, `eslint-plugin-vue`, `vue-eslint-parser`, `dependency-cruiser`, `@types/node`).

##### 2. `tsconfig.json` (Create — `[Fatia 1]`)

*   **Type / Scope**: TypeScript Configuration
*   **Proposed Changes**: Configura `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` (ou isolada em `tsconfig.core.json` conforme Fatia 0), `resolveJsonModule: true` e aliases (`@domain/*`, `@rules/*`, `@application/*`, `@schemas/*`, `@examples/*`, `@storage/*`, `@layout/*`, `@diagram-adapter/*`, `@composition/*`, `@ui/*`).

##### 3. `src/vite-env.d.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Vite & Vue Ambient Types
*   **Proposed Changes**: Declara referência `/// <reference types="vite/client" />` para tipagem de `import.meta.env.DEV`, imports `?url` e módulos `.vue`.

##### 4. `vite.config.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Bundler Configuration
*   **Proposed Changes**: Configura `@vitejs/plugin-vue`, aliases sincronizados com `tsconfig.json` e, caso a Fatia 0 selecione `elkjs` em Web Worker, configura alias de `'web-worker'` para `./src/layout/webWorkerStub.ts` (suprimindo o fallback Node.js interno do pacote `elkjs`) e carregamento sob demanda fora do chunk inicial.

##### 5. `vitest.config.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Test Runner Configuration
*   **Proposed Changes**: Define 3 projetos via `test.projects` (todos com `extends: true` herdando aliases do Vite e excluindo `tests/e2e/**`): `unit` (`environment: 'node'`), `integration-storage` (`environment: 'node'`, `setupFiles: ['tests/setup/indexeddb.ts']`) e `integration-diagram` (`environment: 'happy-dom'`, `setupFiles: ['tests/setup/vueflow.ts']`), além de `coverage` (`provider: 'v8'`) com thresholds `>= 90%` para `src/domain/**` e `src/rules/**` e `>= 85%` para `src/application/**`.

##### 6. `playwright.config.ts` (Create — `[Fatia 5]`)

*   **Type / Scope**: E2E Test Configuration
*   **Proposed Changes**: Configura execução em Chromium contra `webServer.command: 'npm run build && npm run preview -- --port 4173 --strictPort'` para testar sempre o build de produção atualizado.

##### 7. `eslint.config.js` (Create — `[Fatia 1]`)

*   **Type / Scope**: Static Code Quality & Security Linter
*   **Proposed Changes**: Configura Flat Config com `typescript-eslint`, `eslint-plugin-vue` (`vue-eslint-parser` para `<script setup lang="ts">`) e regra obrigatória `vue/no-v-html: 'error'`. *(Fiscalização de fronteiras arquiteturais centralizada em `.dependency-cruiser.cjs`.)*

##### 8. `.dependency-cruiser.cjs` (Create — `[Fatia 1]`)

*   **Type / Scope**: Architectural Dependency Verification (ADR-001)
*   **Proposed Changes**: Configura `options.tsConfig: { fileName: './tsconfig.json' }`, `options.tsPreCompilationDeps: true` e `options.extensions: ['.ts', '.js', '.vue']` aplicando integralmente a matriz de dependências da ADR-001 (Seção 2) e proibindo ciclos entre módulos.

##### 9. `.github/workflows/ci.yml` (Create — `[Fatia 1]`, ampliado nas Fatias 3–5)

*   **Type / Scope**: CI Pipeline
*   **Proposed Changes**: Executa `typecheck`, `lint`, `depcruise` e `test:unit` a partir da Fatia 1; adiciona `test:integration` e `test:coverage` na Fatia 3; adiciona `build` na Fatia 4; adiciona `npx playwright install --with-deps chromium` e `test:e2e` na Fatia 5.

##### 10. `docs/adr/ADR-001-dependency-inversion-ports-adapters.md` (Create — `[Fatia 1]`)

*   **Type / Scope**: Architecture Decision Record
*   **Proposed Changes**: Formaliza a ADR-001 (DIP / Ports & Adapters), listando as portas formais (`ProjectRepository`, `LayoutPort`), adapters concretos, Composition Root (`src/composition/createAppContainer.ts`), separação entre DIP interno e setas desenhadas pelo usuário, e verificação via `npm run depcruise`.

##### 11. `README.md` (Modify — `[Fatia 1]`)

*   **Type / Scope**: Project Documentation
*   **Proposed Changes**: Substitui o placeholder atual pelo resumo do projeto, comandos de desenvolvimento/teste, mapa da arquitetura modular e links relativos para `./docs/adr/ADR-001-dependency-inversion-ports-adapters.md` e `./docs/designs/flow-forge-mvp.md`.

---

#### Domínio Puro (`src/domain/` — `[Fatia 1]`)

##### 12. `src/domain/types.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Pure TypeScript Domain Model
*   **Proposed Changes**: Declara todos os tipos normativos da Seção 3 (`ArchitectureProject`, `DistributedTopology`, `SystemNode`, `RuntimeConnection`, `InternalArchitecture`, `CodeUnit`, `StaticDependency`, `BoundaryBinding`, `ProjectedEndpoint`, `ArchitectureView`, `ViewScope`, `Point2D`, `RuleProfileId`, `StructuralViolation`, `DomainResult`).

##### 13. `src/domain/limits.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Domain Cardinality Bounds
*   **Proposed Changes**: Exporta constantes puras de cardinalidade do domínio (`MAX_TOTAL_NODES = 1_000`, `MAX_TOTAL_EDGES = 3_000`, `MAX_BINDINGS = 3_000`, `MAX_SERVICES = 200`, `MAX_VIEWS = 201`) e mapeamento padrão `DEFAULT_LAYER_BY_UNIT_KIND`.

##### 14. `src/domain/invariants.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Structural Invariants Validator
*   **Proposed Changes**: Implementa `validateStructuralInvariants(project)` verificando unicidade de IDs e de tuplas de binding, ausência de self-loops, integridade referencial, paridade 1:1 entre `internals` e visões `internal`, coordenadas finitas para todos os elementos do escopo, isolamento de nível e limites de `src/domain/limits.ts`.

##### 15. `src/domain/projection.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Pure Boundary Derivation
*   **Proposed Changes**: Implementa `deriveProjectedEndpoints(project, serviceId)` e `deriveBindingDirection(project, binding)` derivando deterministicamente os `ProjectedEndpoint`s ordenados por `(direction, runtimeConnectionId)` sem duplicar dados no modelo persistido.

##### 16. `src/domain/commands.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Pure Domain Commands
*   **Proposed Changes**: Implementa todas as funções puras listadas em "Contratos de Aplicação" (criação, edição, exclusão com limpeza de `nodePositions`, `reconnectRuntimeConnection`, mudança controlada de `SystemNode.kind`, criação sob demanda de arquitetura interna e atualização de posições), retornando `DomainResult<ArchitectureProject>` validado por `validateStructuralInvariants`.

---

#### Schemas e Serialização (`src/schemas/` — `[Fatia 1]`)

##### 17. `src/schemas/projectFileV1.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Versioned Persistence DTO, Limits & Deterministic Serializer
*   **Proposed Changes**: Exporta `CURRENT_SCHEMA_VERSION = 1`, `MAX_IMPORT_FILE_BYTES = 5_242_880`, `ProjectFileDtoV1Schema` em Zod `^4.3.0` (`z.strictObject`, `.exactOptional()`, regex segura de `EntityId`, `.max()` em strings, `z.number().finite()`), `parseProjectFileDtoV1(raw)` (rejeitando `schemaVersion > 1` com `UNSUPPORTED_FUTURE_VERSION`), formatador de erros legíveis via `z.flattenError()` e `serializeProjectFileDeterministically(dto)` com ordenação por `id`.

---

#### Validadores Determinísticos (`src/rules/` — `[Fatia 2]`)

##### 18. `src/rules/types.ts` (Create — `[Fatia 2]`)

*   **Type / Scope**: Diagnostic & Rule Contracts
*   **Proposed Changes**: Declara `Diagnostic`, `DiagnosticTarget`, `DiagnosticSeverity` (`'error' | 'warning'`) e `ArchitectureRule = (project: ArchitectureProject) => readonly Diagnostic[]`.

##### 19. `src/rules/tarjan.ts` (Create — `[Fatia 2]`)

*   **Type / Scope**: Linear Graph Algorithm
*   **Proposed Changes**: Implementa algoritmo de Tarjan $O(V + E)$ sobre grafos dirigidos com saída determinística ordenada lexicograficamente.

##### 20. `src/rules/rulesCatalog.ts` (Create — `[Fatia 2]`)

*   **Type / Scope**: Deterministic Architectural Validators
*   **Proposed Changes**: Implementa a matriz 3×3 de camadas (`hexagonal`, `layered`, `distributed-baseline`) e todas as 9 regras determinísticas da Seção 4 (`LAYER_VIOLATION`, `STATIC_DEPENDENCY_CYCLE`, `DISTRIBUTED_DEPENDENCY_CYCLE`, `UNIMPLEMENTED_INTERFACE`, `INVALID_IMPLEMENTS_TARGET`, `INCOMPATIBLE_RUNTIME_CONNECTION`, `UNBOUND_EXTERNAL_ENDPOINT`, `UNBOUND_ADAPTER`, `BOUNDARY_DIRECTION_MISMATCH`), incluindo IDs de aresta/binding em `targets` e `scope` concreto.

##### 21. `src/rules/evaluateProject.ts` (Create — `[Fatia 2]`)

*   **Type / Scope**: Deterministic Validation Runner
*   **Proposed Changes**: Executa as 9 regras em ordem determinística, gera IDs estáveis `${ruleId}:${scopeKey}:${sortedTargetIds.join(',')}` e ordena por severidade (`error` antes de `warning`), `ruleId` e `id`.

---

#### Exemplos e Sistemas Reais Anonimizados (`src/examples/` — `[Fatia 2]` e `[Fatia 5]`)

##### 22. `src/examples/hexagonalOrdersValid.json` e `src/examples/hexagonalOrdersDefective.json` (Create — `[Fatia 2]`)

*   **Type / Scope**: Built-in Example Fixtures (`schemaVersion: 1`)
*   **Proposed Changes**: Fornece modelo válido de sistema de pedidos (topologia + serviço `Orders API` em Ports & Adapters + `Boundary Binding` completo) e contraparte com defeitos intencionais acionando todas as 9 regras determinísticas.

##### 23. `src/examples/realSystemApiPortsAdapters.json` e `src/examples/realSystemDistributedCommerce.json` (Create — `[Fatia 5]`)

*   **Type / Scope**: Practical Validation Models (`schemaVersion: 1`)
*   **Proposed Changes**: Fornece os 2 sistemas reais anonimizados exigidos em `G8`: API em Ports & Adapters e sistema distribuído com serviços, banco, cache, broker e serviço com arquitetura interna e `Boundary Binding`.

##### 24. `src/examples/index.ts` (Create — `[Fatia 2]`, ampliado na `[Fatia 5]`)

*   **Type / Scope**: Raw Examples Catalog (zero imports internos)
*   **Proposed Changes**: Exporta lista tipada `{ id, title, description, rawPayload: unknown }` com os JSONs importados estaticamente, sem importar `application` ou `schemas` (evitando ciclos).

---

#### Camada de Aplicação e Contratos/Ports (`src/application/` — `[Fatia 3]`)

##### 25. `src/application/ports/ProjectRepository.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Application Port (ADR-001)
*   **Proposed Changes**: Declara `StoredProjectRecord`, `ProjectSummary`, interface `ProjectRepository` (`listSummaries()`, `load(projectId)`, `save(project, expectedRevision: number | null)`, `delete(projectId)`, `close()`) e erros tipados (`RevisionConflictError`, `StorageQuotaError`, `StorageTransactionError`).

##### 26. `src/application/ports/LayoutPort.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Application Port (ADR-001)
*   **Proposed Changes**: Declara `LayoutGraphInput`, `LayoutGraphOutput` e interface `LayoutPort` (`computeLayout(input, signal?)`).

##### 27. `src/application/history/SnapshotHistory.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Pure Undo/Redo History Manager
*   **Proposed Changes**: Implementa pilhas puras em TypeScript (`past`, `future`) de até 50 snapshots imutáveis de `ArchitectureProject`, com métodos `push`, `undo`, `redo`, `canUndo`, `canRedo` e `reset`.

##### 28. `src/application/use-cases/projectLifecycle.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Application Use Cases
*   **Proposed Changes**: Implementa `createProject` (perfil padrão `'hexagonal'`), `openProject` (valida payload retornado por `load()` e inicializa `lastPersistedRevision`), `saveProject` (chama `ProjectRepository.save` com `lastPersistedRevision` e atualiza a revisão retornada), `deleteProject`, `listProjects` e `createProjectFromExample` (submete o payload de `src/examples/` ao pipeline de importação).

##### 29. `src/application/use-cases/editArchitecture.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Application Use Cases (Editing & Undo/Redo)
*   **Proposed Changes**: Implementa `editProject` (executa comandos de `src/domain/commands.ts`, trata `DomainResult`, empilha snapshot anterior em `SnapshotHistory`, incrementa `mutationSeq` e sinaliza `changedSemantically: boolean`) e os casos de uso explícitos `undo()` e `redo()` (restaurando snapshot, incrementando `mutationSeq` e preservando `lastPersistedRevision`).

##### 30. `src/application/use-cases/importExportProject.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Application Use Cases
*   **Proposed Changes**: Declara `ImportFileSource` e implementa o pipeline de importação em 4 etapas (tamanho/extensão pré-leitura -> parse + `schemaVersion === 1` -> Zod `^4.3.0` -> `validateStructuralInvariants`), resolução de colisão de ID (`copy` vs. `replace` mantendo monotonicidade de `persistedRevision`), exportação JSON determinística e exportação de emergência a partir do estado em memória.

##### 31. `src/application/use-cases/applyViewLayout.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Application Use Case
*   **Proposed Changes**: Invoca `LayoutPort.computeLayout(...)` capturando `baseMutationSeq` e `baseScope`; descarta resposta se `mutationSeq` ou `activeScope` mudou durante a execução; aplica novas coordenadas como 1 commit atômico no `SnapshotHistory` (`changedSemantically: false`).

---

#### Adapters de Borda e Composition Root (`[Fatia 3]` e `[Fatia 4]`)

##### 32. `src/storage/IndexedDBProjectRepository.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Storage Adapter (implementa `ProjectRepository`)
*   **Proposed Changes**: Implementa persistência em `flow-forge-db` v1 (store única `projects`) via `idb` com transação única `readwrite` para `get -> check persistedRevision -> put`, tratamento de exclusão externa (`expectedRevision !== null && !stored`), chamada protegida a `navigator.storage?.persist?.()`, mapeamento de `QuotaExceededError` e método `close()`.

##### 33. `src/layout/DagreLayoutAdapter.ts` (Create — `[Fatia 4]`, ou `ElkWorkerLayoutAdapter.ts` + `elkWorkerClient.ts` + `webWorkerStub.ts` se Fatia 0 selecionar Worker)

*   **Type / Scope**: Layout Adapter (implementa `LayoutPort`)
*   **Proposed Changes**: Implementa `LayoutPort` traduzindo `LayoutGraphInput` em coordenadas planas `LayoutGraphOutput` usando `@dagrejs/dagre` (ou, se a Fatia 0 acionar o gatilho de Worker, `ElkWorkerLayoutAdapter` com `import('elkjs/lib/elk-api.js')` dinâmico + `elkWorkerClient` gerenciando `elk-worker.min.js?url` `{ type: 'classic' }`, watchdog 5 s recriando `ELK`, e `src/layout/webWorkerStub.ts` para o alias Vite).

##### 34. `src/diagram-adapter/viewModel.ts` e `src/diagram-adapter/projection.ts` (Create — `[Fatia 4]`)

*   **Type / Scope**: Framework-Neutral Presentation Projection
*   **Proposed Changes**: Define `DiagramViewModel` (nós com badges de `Boundary Binding` e severidade de diagnóstico, arestas diferenciadas por tipo síncrono/assíncrono/estático) e função pura `projectToDiagramViewModel(project, activeScope, diagnostics)`.

##### 35. `src/diagram-adapter/useVueFlowAdapter.ts` (Create — `[Fatia 4]`)

*   **Type / Scope**: Canvas Adapter Composable (`@xyflow/vue` v2)
*   **Proposed Changes**: Composable Vue executado sob `<VueFlowProvider>` mantendo buffer local `shallowRef` atualizado por `@nodes-change` + `applyNodeChanges`, trava `isDragging` impedindo sobrescrita por revalidação durante arraste, leitura de dimensões via `getInternalNode(id)?.measured`, emissão de intenções confirmadas apenas em eventos terminais (`node-drag-stop`, `connect`, exclusão) e garantia de saída sem Proxies do Vue.

##### 36. `src/composition/createAppContainer.ts` (Create — `[Fatia 4]`)

*   **Type / Scope**: Composition Root (ADR-001)
*   **Proposed Changes**: Instancia `IndexedDBProjectRepository` e o adaptador concreto de `LayoutPort`, injeta dependências nos casos de uso (aceitando `Partial<AppContainerDeps>` em testes) e retorna `AppContainer`.

---

#### Camada de Apresentação Vue 3 (`src/ui/`, `index.html`, `src/main.ts`, `src/styles/` — `[Fatia 4]`)

##### 37. `index.html`, `src/styles/base.css` e `src/main.ts` (Create — `[Fatia 4]`)

*   **Type / Scope**: Web Application Entrypoint & Styles
*   **Proposed Changes**: `index.html` define o documento HTML raiz com `#app` e script `/src/main.ts`; `src/styles/base.css` define tokens visuais, tipografia e layout base; `src/main.ts` importa `@xyflow/vue/style.css` e `./styles/base.css`, cria `AppContainer` via `createAppContainer()` e monta `App.vue` fornecendo o container por `provide`.

##### 38. `src/ui/diagnostics/localDiagnosticLog.ts` (Create — `[Fatia 4]`)

*   **Type / Scope**: Minimal Local Diagnostics Utility
*   **Proposed Changes**: Implementa ring-buffer em memória (200 eventos sem nomes/descrições do usuário), exportação JSON com opt-in explícito para anexar o projeto atual e guardião `DEV` que executa `validateStructuralInvariants` + `structuredClone(project)` após commits.

##### 39. `src/ui/composables/useWorkspace.ts` (Create — `[Fatia 4]`)

*   **Type / Scope**: Vue Presentation State Composable (sem Pinia)
*   **Proposed Changes**: Gerencia `shallowRef<ArchitectureProject | null>`, `activeScope`, `selectedElement`, `diagnostics`, `canUndo`/`canRedo`, `dirtyFlag`, `unexportedChangesFlag`, câmera efêmera por `(projectId, scopeKey)`, fila serializada *single-flight* de autosave (debounce 600 ms + `flush()` ao trocar/fechar projeto), debounce de validação (200 ms quando `changedSemantically`), listener `beforeunload` e estado do banner de recuperação de storage/revisão.

##### 40. `src/ui/components/TopBar.vue` (Create — `[Fatia 4]`)

*   **Type / Scope**: UI Component
*   **Proposed Changes**: Renderiza seletor de projetos/exemplos, breadcrumbs (`Topologia > Serviço`), seletor de `ruleProfile`, botões Undo/Redo, "Organizar layout", Importar/Exportar JSON (com indicador contínuo de alterações não exportadas), modal/checkbox opt-in de exportação de diagnóstico local e banner de recuperação ("Recarregar" / "Baixar JSON da memória").

##### 41. `src/ui/components/ElementPalette.vue` (Create — `[Fatia 4]`)

*   **Type / Scope**: UI Component
*   **Proposed Changes**: Renderiza paleta contextual ao `activeScope` (Nível 1: tipos de `SystemNode`; Nível 2: tipos de `CodeUnit` com indicação da camada padrão), usando o glossário fechado e legenda fixa do sentido das setas do nível ativo.

##### 42. `src/ui/components/ArchitectureCanvas.vue` (Create — `[Fatia 4]`)

*   **Type / Scope**: UI Component
*   **Proposed Changes**: Envolve `<VueFlow>` em `<VueFlowProvider>`, conecta `useVueFlowAdapter`, renderiza nós customizados (indicador de drill-down em `service`, badges de `Boundary Binding` e severidade em adaptadores), setas diferenciadas por tipo, indicador de direção durante arraste, clique duplo para drill-down e atalhos de teclado com guarda de foco em campos de formulário.

##### 43. `src/ui/components/InspectorPanel.vue` (Create — `[Fatia 4]`)

*   **Type / Scope**: UI Component
*   **Proposed Changes**: Renderiza formulário de propriedades do elemento/conexão selecionado (incluindo reconexão de origem/destino e inversão de direção) e, no Nível 2, seção fixa **"Fronteira Externa"** listando cada `ProjectedEndpoint` (direção, nó vizinho, protocolo, status vinculado/pendente) com controle explícito para vincular/desvincular adaptadores.

##### 44. `src/ui/components/DiagnosticsPanel.vue` (Create — `[Fatia 4]`)

*   **Type / Scope**: UI Component
*   **Proposed Changes**: Renderiza painel inferior colapsável agrupando diagnósticos por severidade, exibindo `ruleId`, mensagem, evidência e sugestão; clique navega ao `diagnostic.scope`, destaca `targets` e centraliza a câmera nos nós afetados.

##### 45. `src/ui/components/ImportConflictModal.vue` e `src/ui/App.vue` (Create — `[Fatia 4]`)

*   **Type / Scope**: UI Components
*   **Proposed Changes**: `ImportConflictModal.vue` exibe escolha explícita ("Importar como cópia" vs. "Substituir existente") em colisão de ID e mensagens legíveis de erro de importação; `App.vue` compõe o layout principal (TopBar, paleta à esquerda, canvas ao centro, inspetor à direita, diagnósticos na base e tela vazia inicial quando não há projetos salvos).

---

#### Testes e Documentação de Validação (`tests/` e `docs/validation/`)

##### 46. `tests/setup/indexeddb.ts` e `tests/setup/vueflow.ts` (Create — `[Fatia 3]` e `[Fatia 4]`)

*   **Type / Scope**: Vitest Environment Setup Files
*   **Proposed Changes**: `indexeddb.ts` (`[Fatia 3]`) carrega `fake-indexeddb/auto`; `vueflow.ts` (`[Fatia 4]`) registra polyfills necessários do `@xyflow/vue` em `happy-dom` (`ResizeObserver`, `DOMMatrixReadOnly`, `offsetWidth`/`offsetHeight`, `SVGElement.prototype.getBBox`).

##### 47. `tests/fakes/InMemoryProjectRepository.ts` e `tests/fakes/StubLayoutAdapter.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Unit Test Doubles (ADR-001)
*   **Proposed Changes**: Implementam `ProjectRepository` (simulando CAS de `persistedRevision`, exclusão externa e erro injetável de quota) e `LayoutPort` (retornando posições determinísticas com atraso opcional controlável para testar descarte de layout obsoleto).

##### 48. `tests/unit/domain/commandsAndInvariants.spec.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Domain Unit Tests (Vitest / Node)
*   **Proposed Changes**: Testa criação/edição/exclusão em ambos os níveis, todos os códigos de `StructuralViolation` (incluindo unicidade de binding, paridade de visões e limpeza de `nodePositions`), `deriveProjectedEndpoints`, `reconnectRuntimeConnection`, mudança de `SystemNode.kind` e todas as transições da tabela de ciclo de vida do `Boundary Binding`.

##### 49. `tests/unit/schemas/projectFileV1.spec.ts` (Create — `[Fatia 1]`)

*   **Type / Scope**: Schema & Security Unit Tests (Vitest / Node)
*   **Proposed Changes**: Testa limite de 5 MB, rejeição de `schemaVersion: 2`/`99`/`0`, campos extras em `z.strictObject`, `.exactOptional()`, bloqueio de chaves reservadas (`__proto__`, `constructor`, `toString`), limites de string, coordenadas `NaN`/`Infinity`, ordenação determinística no export e round-trip sem perda.

##### 50. `tests/unit/rules/validators.spec.ts` (Create — `[Fatia 2]`)

*   **Type / Scope**: Rules & Performance Unit Tests (Vitest / Node)
*   **Proposed Changes**: Testa algoritmo de Tarjan, todas as 9 regras (incluindo `implements` em `LAYER_VIOLATION` e `STATIC_DEPENDENCY_CYCLE`, `async-publish`/`async-consume` com broker, compatibilidade de `protocol`, matriz 3×3 completa em `hexagonal`/`layered`/`distributed-baseline`, inclusão de ID de aresta em `targets`), e benchmark verificando latência `< 50 ms` para grafo sintético de 200 nós e 500 arestas.

##### 51. `tests/unit/examples/examplesIntegrity.spec.ts` (Create — `[Fatia 2]`, ampliado nas `[Fatia 3]` e `[Fatia 5]`)

*   **Type / Scope**: Examples & Real Models Regression Tests
*   **Proposed Changes**: Na Fatia 2 valida os 2 exemplos base via `projectFileV1` + `invariants` + `evaluateProject` (zero diagnósticos no válido; correspondência exata das 9 regras no defeituoso); na Fatia 3 passa a exercitar `importProject`; na Fatia 5 inclui os 2 sistemas reais anonimizados (zero erros estruturais).

##### 52. `tests/unit/application/useCases.spec.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Application Unit Tests (Vitest / Node)
*   **Proposed Changes**: Testa limite exato de 50 snapshots em `SnapshotHistory`, restauração atômica de exclusão em cascata de conexão + bindings, `Undo`/`Redo` sem regressão de `lastPersistedRevision`, reversão de layout em 1 `Undo`, descarte de layout obsoleto via `mutationSeq` (incluindo cenário `edição -> layout -> Undo -> Redo`), importação `copy` vs `replace` com monotonicidade de revisão, e erro de `QuotaExceededError`.

##### 53. `tests/integration/storage/indexedDbRepository.spec.ts` (Create — `[Fatia 3]`)

*   **Type / Scope**: Storage Integration Tests (`fake-indexeddb`)
*   **Proposed Changes**: Testa gravação atômica, recarga completa, CAS em transação única `readwrite`, detecção de conflito de `persistedRevision` e de exclusão externa, injeção de `DOMException(..., 'QuotaExceededError')` via spy em `IDBObjectStore.prototype.put` e limpeza (`repo.close()` + `deleteDatabase`) em `afterEach`.

##### 54. `tests/integration/diagram/vueFlowAdapter.spec.ts` (Create — `[Fatia 4]`)

*   **Type / Scope**: Diagram Adapter & Recovery UI Integration Tests (`happy-dom`)
*   **Proposed Changes**: Testa `projectToDiagramViewModel` (badges de `Boundary Binding` e diferenciação visual de setas), `useVueFlowAdapter` (`@nodes-change` + trava `isDragging` + commit só em `node-drag-stop`), ausência de Proxies via `structuredClone` e ativação do banner de recuperação em `QuotaExceededError` e `RevisionConflictError`.

##### 55. `tests/e2e/flowForge.spec.ts` (Create — `[Fatia 5]`)

*   **Type / Scope**: End-to-End Browser Tests (Playwright)
*   **Proposed Changes**: Executa `CUJ 1`–`CUJ 4` no navegador sobre `vite preview`: modelagem de topologia + drill-down + `Boundary Binding` no `InspectorPanel` com badges no canvas, detecção/navegação/correção de defeitos no exemplo defeituoso, layout sob demanda + `Ctrl+Z`, recarga da página (persistência IndexedDB), rejeição de JSON corrompido/versão futura e reimportação de JSON válido (`copy` e `replace`).

##### 56. `docs/validation/real-systems-evaluation.md` (Create — `[Fatia 5]`)

*   **Type / Scope**: Practical Validation Report (`G8`)
*   **Proposed Changes**: Documenta a modelagem manual de `realSystemApiPortsAdapters.json` e `realSystemDistributedCommerce.json` preenchendo as 5 dimensões obrigatórias de `G8` (atrito de edição, clareza das setas, navegação entre níveis, precisão dos diagnósticos e limitações frente à verificação de código real).

### Verification Plan

*   **Architectural Guardrails (ADR-001):** `npm run depcruise` (`dependency-cruiser` cobrindo `.ts` e `.vue`) e `npm run lint` (`eslint` com `vue/no-v-html`) retornam código 0 sem violações.
*   **Typecheck & Production Build:** `npm run typecheck` (`vue-tsc --noEmit`) e `npm run build` (`vite build`) concluem sem erros. Caso a Fatia 0 adote `elkjs` em Web Worker, um passo de CI verifica que o chunk principal (`dist/assets/index-*.js`) não contém referências a `elk-worker` nem ultrapassa o teto de tamanho definido no relatório da Fatia 0.
*   **Unit Tests & Coverage (Node puro):** `npm run test:unit` e `npm run test:coverage` passam sem falhas com limiares aplicados pelo Vitest: `>= 90%` em `src/domain/` e `src/rules/`, `>= 85%` em `src/application/`, matriz comportamental completa em `tests/unit/schemas/projectFileV1.spec.ts` e benchmark `< 50 ms` para 200 nós / 500 arestas em `validators.spec.ts`.
*   **Integration Tests:** `npm run test:integration` passa em `integration-storage` (`fake-indexeddb`) e `integration-diagram` (`happy-dom` com polyfills), incluindo cenários de `QuotaExceededError` e `RevisionConflictError`.
*   **E2E Tests:** `npm run test:e2e` (Playwright sobre build de produção) passa integralmente para `CUJ 1`–`CUJ 4`.
*   **Practical Validation (`G8`):** os 2 modelos reais anonimizados passam em `examplesIntegrity.spec.ts` com zero erros estruturais e o relatório [real-systems-evaluation.md](../validation/real-systems-evaluation.md) tem as 5 dimensões preenchidas e revisadas pelo autor.

---

<!-- Provenance: Drafted and resolved via EGM. -->

*Drafted with EGM*
