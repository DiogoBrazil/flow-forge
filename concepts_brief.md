# Flow-Forge (MVP / Etapa 1)

* **Author:** DiogoBrazil
* **Date:** 2026-11-19
* **EGM Review Execution:** 7 revisores Goldfish executados em paralelo e em contextos isolados via despacho direto (`egm-design`, `egm-codebase-details`, `egm-zoom-out`, `egm-comprehension`, `egm-implementation-readiness`, `egm-structural`, `egm-inventive-catalyst`), pois o subagente `egm-synthesizer` não dispõe de ferramenta de spawn aninhado neste ambiente (fallback previsto em `docs/harnesses.md`). Documento atualizado com as decisões consolidadas do autor após a rodada Goldfish.

## Overview

O Flow-Forge é uma aplicação web local-first para modelagem visual multinível, navegação hierárquica e validação estrutural determinística de arquiteturas de software e sistemas distribuídos durante concepção e *design review* (antes da implementação em código).

O público-alvo são desenvolvedores, arquitetos de software e engenheiros de sistemas que precisam desenhar, explorar e verificar a consistência de arquiteturas declaradas sem ficar restritos a diagramas sem semântica (draw.io, Excalidraw) nem a fluxos exclusivamente textuais (Structurizr DSL, Mermaid, LikeC4).

Na Etapa 1 (MVP), o Flow-Forge integra dois níveis semânticos sobre uma fonte única de verdade: **topologia distribuída** (comunicação em runtime) e **arquitetura interna de serviços** (dependências estáticas de software), conectados por um vínculo explícito de fronteira (**`Boundary Binding`**). Validadores determinísticos em código inspecionam o modelo declarado e exibem diagnósticos não bloqueantes ligados aos elementos afetados. O MVP não acessa código-fonte nem afirma validar a implementação real; a comparação entre arquitetura planejada e código fica prevista como direção futura (Etapa 4).

## Analysis

A revisão paralela nas 7 lentes Goldfish revelou riscos de acoplamento de estado, colisão semântica, segurança de importação e inflação de escopo. A consolidação abaixo registra o destino de cada recomendação, as contradições resolvidas e os riscos ainda pendentes de evidência experimental.

### 1. Rastreabilidade das Recomendações Goldfish

| Tema / Origem Goldfish | Decisão | Justificativa Sucinta |
| :--- | :--- | :--- |
| **Vínculo explícito entre níveis (`Boundary Binding`)** (`design`, `structural`, `comprehension`, `implementation-readiness`, `codebase-details`, `inventive-catalyst`) | **Adotada** | Obrigatório no MVP para que o produto seja uma plataforma integrada e não dois editores isolados. Fronteira externa projetada na visão interna com vinculação manual explícita ao adaptador responsável (sem inferência automática). |
| **Glossário fechado + diferenciação visual de setas** (`comprehension`, `structural`) | **Adotada** | Elimina ambiguidade entre `Handle/Anchor`, `Endpoint`, `Interface/Port`, `View` e `Scope/Level`, e evita inversão acidental entre chamadas de runtime e dependências estáticas. |
| **Projeto único Vite + TS (Monólito Modular) + lint/CI de fronteiras** (unânime nas 7 lentes) | **Adotada** | Evita atrito prematuro de 5 pacotes em monorepo mantendo isolamento hexagonal real garantido por verificação automatizada de imports. |
| **Descarte do Rete.js v2** (`design`, `codebase-details`, `zoom-out`, `implementation-readiness`) | **Adotada** | Paradigma de programação visual por sockets/dataflow não atende diagramação arquitetural multinível. |
| **Visão canônica única por nível no MVP** (`zoom-out`) | **Adotada** | Remove complexidade de sincronização de visões parciais, Model Explorer avançado e "remover da visão vs. excluir do modelo", mantendo `views[]` separado no JSON versionado para evolução futura. |
| **Corte de grupos aninhados arrastáveis e portas visuais arbitrárias no MVP** (`zoom-out`, `design`) | **Adotada** | Elimina bugs de coordenadas relativas/redimensionamento de grupos e handles dinâmicos, priorizando hierarquia via drill-down e relacionamentos semanticamente tipados. |
| **Separação entre invariantes estruturais bloqueantes e diagnósticos não bloqueantes** (`design`, `structural`, `comprehension`, `implementation-readiness`, `inventive-catalyst`) | **Adotada** | Permite rascunho livre e modelos propositalmente defeituosos sem comprometer integridade persistível. |
| **Fluxo unidirecional no canvas sem `v-model:nodes` direto no Pinia/domínio** (`design`, `codebase-details`, `implementation-readiness`) | **Adotada** | Protege responsividade durante drag, evita poluição do Undo/Redo e impede `DataCloneError` com Proxies do Vue 3 no IndexedDB/Worker. |
| **Persistência local-first com `idb`, `schemaVersion`, pipeline de importação em 4 etapas e backup pré-migração** (`codebase-details`, `implementation-readiness`, `design`) | **Adotada** | Impede DoS local antes do `JSON.parse`, detecta corrupção/referências órfãs (Zod v4 + integridade referencial) e evita perda de dados em falhas de quota/migração. |
| **Validação prática em 2 sistemas reais além de exemplos com defeitos injetados** (`zoom-out`) | **Adotada** | Mede atrito real de modelagem, clareza de setas e utilidade prática dos diagnósticos. |
| **Spike técnica descartável de `@xyflow/vue` v2 + layout** (`design`, `codebase-details`, `implementation-readiness`) | **Ajustada** | Mantida como pré-requisito antes de comprometer a implementação, incluindo estresse progressivo até 300 nós, mas sem exigir 60 FPS absolutos em qualquer hardware. |
| **Motor de layout (`elkjs` em Web Worker vs. alternativa mais simples)** (`design`, `codebase-details` vs. `zoom-out`) | **Ajustada** | Preferência inicial por `elkjs` sob demanda (reversível em 1 Undo), avaliando na spike custo de bundle/Worker/build; fallback para execução mais simples ou `dagre` se reduzir risco substancialmente para grafos de 5–50 nós. |
| **Undo/Redo por comandos/patches inversíveis** (`design`, `inventive-catalyst`) vs. **snapshots imutáveis** (`implementation-readiness`, `zoom-out`) | **Ajustada** | Adotados **snapshots imutáveis limitados (~50 ações por projeto/sessão, em memória)** no MVP pela atomicidade simples entre modelo e visões; comandos inversíveis adiados. |
| **Observabilidade local-first** (`codebase-details`) | **Ajustada** | Reduzida ao mínimo útil no MVP: eventos diagnósticos estruturados exportáveis + verificador de invariantes em desenvolvimento, sem construir subsistema complexo de observabilidade. |
| **Perfis de regras independentes por serviço** (`design`, `comprehension`) | **Adiada** | MVP começa com configuração simples de perfil por projeto respeitando tipo/semântica de cada elemento (sem assumir estilo único para todo serviço); perfis por serviço ficam para evolução posterior. |
| **Múltiplas visões arbitrárias, grupos aninhados e portas configuráveis** (`design`, `comprehension`) | **Adiada** | Mantidas como evoluções compatíveis com o schema `views[]`, fora do escopo da Etapa 1. |

### 2. Contradições Inventivas, Padrões de Resolução e Ideal Final Result (`inventive-catalyst`)

| Contradição | Padrão Aplicado | Resolução Adotada | Trade-off Secundário |
| :--- | :--- | :--- | :--- |
| **Núcleo unificado vs. Separação semântica entre níveis** | *Segmentation* + *Inversion* | Envelope mínimo comum (identidade estável, hierarquia, metadados) + submodelos discriminados (`RuntimeTopology` e `InternalStructure`), conectados por projeção explícita da fronteira do serviço pai na visão interna (`Boundary Binding`). | Alterações ou exclusões na topologia podem deixar vínculos internos órfãos; tratados como diagnósticos não bloqueantes com regras explícitas de integridade referencial no `/egm-draft`. |
| **Fluidez de interação no canvas vs. Domínio determinístico e Undo/Redo** | *Segmentation* + *Intermediary* | Estado transitório de arraste/seleção isolado no adaptador de diagrama; apenas operações confirmadas gravam snapshots imutáveis (~50 passos) e disparam validação/autosave. | Necessidade de tratar cancelamento de gestos no adaptador e garantir serialização livre de Proxies do Vue 3 na fronteira. |
| **Rigor arquitetural vs. Rascunho livre e defeitos propositais** | *Blessing in Disguise* | Bloquear apenas invariantes estruturais de integridade/persistência; permitir estados arquiteturalmente incorretos como diagnósticos vivos com evidência e navegação direta. | Exige fronteira explícita e bem testada entre o que impede commit/import e o que gera `Diagnostic`. |
| **Inversão de dependências (DIP) rígida vs. Velocidade no MVP** | *Extraction* + *Preliminary Action* | Monólito modular em projeto único Vite + TS com contratos/ports apenas em fronteiras reais e bloqueio automático de acoplamento via lint/CI, sem monorepo nem container de DI. | Requer manter regras de lint/CI ativas continuamente; extração física de pacotes só ocorre quando surgir segundo consumidor real. |
| **Recursos nativos da biblioteca visual vs. Proteção contra lock-in** | *Cheap Dispensables* + *Inversion* | `VueFlowDiagramAdapter` fino e específico nas bordas traduzindo ViewModels para o canvas, mantendo domínio, casos de uso, regras e schemas 100% livres de `@xyflow/vue`. | Eventual troca de biblioteca visual ainda exige reescrever a borda de apresentação, mas preserva integralmente domínio, regras e projetos salvos. |

**Ideal Final Result (IFR):** O usuário modela a topologia distribuída de um sistema sem bloqueios artificiais, faz drill-down em qualquer serviço encontrando sua fronteira externa já projetada para vinculação explícita aos adaptadores internos, e recebe diagnósticos determinísticos claros sobre camadas, ciclos e coerência entre níveis — sobre uma base modular com inversão de dependências verificada em CI e persistência local recuperável.

### 3. Riscos Ainda Não Resolvidos

1. **Incerteza técnica de integração do canvas e layout (a resolver na spike descartável):**
   * Comportamento real do `@xyflow/vue` v2.0.0 (lançado em nov/2026) em nós customizados, handles tipados, separação entre estado transitório e confirmado sem `v-model:nodes`, serialização sem Proxies do Vue e desempenho sob carga progressiva até 300 nós.
   * Viabilidade operacional do `elkjs` (bundle, Web Worker no `vite build`, alias de `'web-worker'`, timeout e descarte de resultados obsoletos por revisão) versus execução mais simples ou `dagre` para grafos de 5–50 nós.
2. **Ciclo de vida do `Boundary Binding` sob mutações:**
   * A semântica exata de renomeação, alteração de protocolo/direção e exclusão de conexões na topologia externa sobre vínculos internos existentes precisa ser fechada no `/egm-draft` com testes de integridade referencial para não criar sincronização implícita frágil.
3. **Adoção e atrito de modelagem manual:**
   * Mesmo com validação determinística correta, o atrito de edição pode tornar o editor lento para *design review*. Esse risco só será medido objetivamente na validação prática com os dois sistemas reais.

## Goals vs. Non-Goals

### In-Scope Goals (Etapa 1 / MVP)

* **Inversão de dependências permanente (DIP / Ports & Adapters):** núcleo de domínio e casos de uso sem dependências de Vue, Pinia, `@xyflow/vue`, IndexedDB, `elkjs` ou APIs de navegador; contratos definidos nas camadas internas para fronteiras reais, adapters nas bordas, Composition Root explícito (sem container de DI) e validação automática de fronteiras em lint/CI.
* **Projetos locais e portáveis:** criar, abrir, editar e excluir projetos via IndexedDB (`idb`) com gravação atômica por projeto, prevenção proporcional de conflito entre abas (revisão otimista e/ou `BroadcastChannel`), exportação JSON determinística com `schemaVersion: 1`, migrações lineares quando aplicáveis, backup pré-migração, rejeição segura de versões futuras, fallback de download JSON em erros de escrita/quota e importação protegida em 4 etapas (limite de tamanho antes de `JSON.parse` -> limites de cardinalidade -> Zod v4 estrito -> integridade referencial).
* **Visão canônica por nível com modelo separado de apresentação:** identidade estável nos elementos de domínio; coordenadas e propriedades visuais isoladas em `views[]` (1 visão canônica por nível hierárquico no MVP, schema preparado para múltiplas visões futuras). Navegação via drill-down e breadcrumbs.
* **Modelagem em dois níveis com `Boundary Binding` obrigatório:**
  * Nível 1 — Topologia distribuída (comunicação em runtime: clientes, gateways, serviços, bancos, caches, filas, sistemas externos).
  * Nível 2 — Arquitetura interna de serviços (dependências estáticas: adaptadores, casos de uso, domínio, interfaces/portas, camadas).
  * Fronteira externa do serviço projetada na visão interna para vinculação manual explícita ao adaptador interno correspondente (sem inferência automática da arquitetura interna).
  * Glossário fechado (`Handle/Anchor`, `Endpoint`, `Interface/Port`, `View`, `Scope/Level`) e diferenciação visual inequívoca entre setas de comunicação em runtime e setas de dependência estática.
* **Validadores determinísticos em código (sem DSL):** distinção formal entre invariantes estruturais bloqueantes e diagnósticos arquiteturais não bloqueantes (`ruleId`, severidade, evidência, referências navegáveis). Catálogo enxuto cobrindo ciclos (Tarjan $O(V+E)$), violações de camada, interfaces sem implementação, incompatibilidades semânticas e consistência de `Boundary Binding`, com configuração simples de perfil por projeto respeitando a semântica de cada elemento.
* **Layout automático sob demanda e Undo/Redo atômico:** layout disparado explicitamente pelo usuário sem sobrescrever posições manuais silenciosamente, reversível em 1 Undo; histórico de Undo/Redo por snapshots imutáveis limitados (~50 ações por projeto/sessão, somente operações confirmadas, não persistido no IndexedDB).
* **Observabilidade local mínima:** eventos diagnósticos estruturados exportáveis e verificações de invariantes em desenvolvimento.
* **Validação técnica e prática:** testes automatizados de domínio/regras/persistência com modelos de exemplo (válidos e com defeitos injetados) + validação manual modelando ao menos dois sistemas reais anonimizados (uma API em Ports and Adapters e um sistema distribuído com serviços/banco/cache contendo um serviço com arquitetura interna e `Boundary Binding`).

### Out-of-Scope Non-Goals

* **Recortes adiados na apresentação do MVP:** múltiplas visões arbitrárias do mesmo nível, Model Explorer avançado, distinção "remover da visão" vs. "excluir do modelo", grupos aninhados arrastáveis no mesmo canvas, portas visuais arbitrariamente configuráveis pelo usuário e perfis de regras independentes por serviço.
* **Infraestrutura e engenharia adiadas:** monorepo multipacotes, container/framework de DI, interfaces artificiais para serviços determinísticos internos, motor de comandos/patches inversíveis para Undo/Redo e subsistema complexo de observabilidade.
* **Etapas futuras (2–4), proibidos campos ou abstrações especulativas na v1:** fluxos condicionais executáveis (retries, timeouts, caminhos alternativos), motor de simulação de carga/falhas, modelagem detalhada de implantação (ambientes/réplicas), análise de repositórios e verificação de aderência ao código real, DSL própria de regras, colaboração em tempo real, autenticação, backend remoto obrigatório (Go/PostgreSQL), versão desktop (Wails/Tauri), marketplace de plugins externos, geração de código e assistente de IA.

## Alternatives Weighed

* **Monorepo multipacotes (`architecture-core`, `architecture-rules`, `diagram-adapter`, `project-storage`, `shared-schemas`) no MVP:** *Rejeitado pelo autor após consenso das 7 lentes Goldfish.* Sem segundo consumidor real (CLI/backend), adiciona atrito de build, exports e HMR sem benefício; substituído por monólito modular em projeto único Vite + TypeScript com lint/CI impondo fronteiras.
* **Rete.js v2 como motor visual:** *Rejeitado (`design`, `codebase-details`, `zoom-out`, `implementation-readiness`).* Orientado a programação visual de fluxo de dados por sockets e composição pesada de plugins, inadequado para diagramação arquitetural multinível.
* **Abstração universal única de `Port` e `Relationship` para topologia e estrutura interna:** *Rejeitada pelo autor e pelas lentes (`design`, `structural`, `comprehension`, `inventive-catalyst`).* Mistura semânticas incompatíveis (comunicação em runtime vs. dependência estática) e compromete invariantes e direção de setas.
* **Múltiplas visões arbitrárias do mesmo nível no MVP:** *Adiado pelo autor após revisão `egm-zoom-out`.* Introduz sincronização de visões parciais, Model Explorer avançado e semântica dupla de exclusão antes de validar o núcleo; substituído por 1 visão canônica por nível preservando `views[]` no schema.
* **Grupos aninhados arrastáveis no mesmo canvas e portas visuais configuráveis no MVP:** *Adiado pelo autor após revisão `egm-zoom-out`.* Alto custo de implementação e bugs de coordenadas relativas/redimensionamento; substituído por navegação hierárquica (drill-down) e relacionamentos tipados.
* **Inferência automática da arquitetura interna a partir da topologia externa:** *Rejeitada pelo autor.* Esconde decisões de design e acopla os níveis; substituída por projeção da fronteira externa com `Boundary Binding` manual explícito e diagnósticos de divergência.
* **Adotar LikeC4 ou Structurizr em vez de construir o Flow-Forge:** *Avaliado e rejeitado como substituto (`zoom-out` + visão do autor).* Ferramentas *model-as-code* atendem bem documentação textual C4, mas não entregam modelagem primariamente visual com feedback imediato no canvas durante concepção; mantidas como referência de metamodelo.
* **Sincronização bidirecional (`v-model:nodes`) entre `@xyflow/vue` e Pinia/domínio:** *Rejeitada (`design`, `codebase-details`, `implementation-readiness`).* Degrada fluidez de arraste, polui histórico de Undo/Redo e provoca `DataCloneError` com Proxies do Vue 3.
* **API crua do IndexedDB, Dexie ou `localStorage`:** *Rejeitados (`codebase-details`, `zoom-out`).* `localStorage` é síncrono e pequeno; API crua aumenta risco de erro transacional; Dexie traz abstrações de query desnecessárias para persistência atômica de documentos. Escolhido `idb`.
* **Undo/Redo por comandos/patches inversíveis ou persistido no IndexedDB:** *Adiado/Rejeitado pelo autor.* Snapshots imutáveis limitados (~50 ações em memória) eliminam bugs de reversão parcial entre domínio e visões no MVP; histórico não é persistido.
* **Container/framework de DI e interfaces para cada classe/serviço interno:** *Rejeitados pelo autor.* Composition Root explícito e contratos apenas em fronteiras reais preservam DIP sem burocracia artificial.
* **`@xyflow/react` como motor de canvas:** *Mantido como alternativa de contingência.* Só será adotado mediante evidência objetiva de bloqueio ou custo desproporcional do `@xyflow/vue` v2 durante a spike técnica descartável.
* **`dagre` (ou `elkjs` simplificado sem Worker) como motor de layout:** *Mantido como alternativa de contingência.* Será adotado se a spike mostrar que `elkjs` em Web Worker traz risco de bundle/build/manutenção desproporcional para grafos típicos de 5–50 nós.

## Key Decisions & Staging for Next Steps

### 1. Proposta de ADR Permanente — ADR-001: Inversão de Dependências (DIP) e Ports & Adapters

* **Status:** Proposta consolidada para formalização no `/egm-draft`.
* **Decisão:** Todas as integrações reais do Flow-Forge com infraestrutura, apresentação, persistência e layout seguem estritamente o Princípio da Inversão de Dependências (DIP) e Ports & Adapters.
  * **Camadas internas (`domain`, `rules`, `application`):** livres de qualquer import de Vue, Pinia, `@xyflow/vue`, IndexedDB/`idb`, `elkjs`, APIs de navegador, drivers ou SDKs externos.
  * **Contratos definidos pelo consumidor:** `application` (e `domain`, quando aplicável) define interfaces enxutas apenas para fronteiras reais (ex.: `ProjectRepository`, `LayoutPort` se necessário, `DiagramViewModel` na borda de apresentação). Serviços puramente determinísticos (ex.: validadores de grafo) permanecem funções/serviços internos sem interfaces artificiais.
  * **Adapters nas bordas:** implementam os contratos internos e traduzem tipos externos (ex.: `IndexedDBProjectRepository`, `ElkLayoutAdapter`, `VueFlowDiagramAdapter`, fakes em memória nos testes). Nenhum tipo de biblioteca externa vaza para dentro.
  * **Composition Root explícito:** instancia adapters e injeta dependências nos casos de uso em ponto único de bootstrap da aplicação, sem container/framework de DI no MVP.
  * **Separação semântica explícita:** a direção de dependências do código-fonte do Flow-Forge (DIP interno) não se confunde com o sentido das relações desenhadas pelo usuário para modelar outros sistemas.
* **Critérios de Aceitação Verificáveis (obrigatórios no `/egm-draft` e na implementação):**
  1. Documentação explícita de quem define cada contrato, quais adapters o implementam e onde ocorre a composição.
  2. Regras automatizadas no lint/CI (`eslint-plugin-boundaries`, `dependency-cruiser` ou equivalente) falhando o build caso `domain`, `rules` ou `application` importem módulos externos proibidos (`vue`, `pinia`, `@xyflow/vue`, `idb`, `elkjs`, `storage`, `diagram-adapter`, `ui`).
  3. Suíte unitária executando casos de uso e validadores em Node/Vitest com implementações *in-memory*/fakes, sem DOM, sem IndexedDB real e sem montar componentes Vue.

### 2. Decisões Consolidadas para Levar ao `/egm-draft`

1. **Organização do código:** Projeto único Vite + TypeScript (Monólito Modular) com Vue 3 na apresentação e módulos internos (`domain`, `application`, `rules`, `schemas`, `storage`, `diagram-adapter`, `ui`) protegidos por lint/CI.
2. **Escopo de visões e hierarquia:** 1 visão canônica por nível hierárquico (drill-down + breadcrumbs), `views[]` isolado no JSON versionado, sem grupos aninhados arrastáveis e sem portas visuais configuráveis no MVP.
3. **Semântica e glossário fechado:** Separação entre Topologia Distribuída (runtime) e Arquitetura Interna (estática), ligados por `Boundary Binding` manual obrigatório; glossário fechado (`Handle/Anchor`, `Endpoint`, `Interface/Port`, `View`, `Scope/Level`) e estilos visuais distintos de setas antes do desenho de UI.
4. **Validação e Undo/Redo:** Invariantes estruturais bloqueantes vs. diagnósticos arquiteturais não bloqueantes (catálogo enxuto em código, sem DSL, perfil por projeto respeitando semântica de elementos); Undo/Redo via ~50 snapshots imutáveis em memória sobre operações confirmadas; auto-layout sob demanda reversível em 1 Undo.
5. **Persistência e segurança:** IndexedDB via `idb` (gravação atômica por projeto), JSON versionado (`schemaVersion: 1`), pipeline de importação em 4 etapas (tamanho pré-parse, cardinalidade, Zod v4 estrito, integridade referencial), backup pré-migração, rejeição segura de versões futuras, fallback de download JSON e observabilidade local mínima.
6. **Validação prática obrigatória:** Modelagem de 2 sistemas reais anonimizados (API em Ports & Adapters + sistema distribuído com serviço interno e `Boundary Binding`) como critério de avaliação de utilidade além dos testes automatizados.

### 3. Portão Técnico Pendente — Spike Técnica Descartável (Pré-Implementação)

Antes de congelar definitivamente a escolha de biblioteca visual e layout na implementação do MVP (sem autorizar código de produção nem infraestrutura definitiva), executar uma spike descartável cobrindo:
1. Nós customizados, handles técnicos e conexões semanticamente tipadas em `@xyflow/vue` v2.
2. Navegação hierárquica e interações estritamente necessárias ao MVP.
3. Fluxo unidirecional sem `v-model:nodes` ligado ao Pinia/domínio, separando estado transitório de drag e commits.
4. Serialização e envio seguros para IndexedDB/Worker sem Proxies do Vue (`DataCloneError`).
5. Integração de layout automático (`elkjs` em Web Worker vs. alternativa mais simples / `dagre`) funcionando em `vite build` de produção, avaliando tamanho de bundle, timeout e descarte de resultados obsoletos.
6. Estresse progressivo de elementos até 300 nós (observando responsividade prática, sem impor 60 FPS absolutos em qualquer hardware).

Trocar para `@xyflow/react` ou `dagre` apenas se a spike apresentar evidência concreta de bloqueio ou custo desproporcional de manutenção.

### 4. Itens de Especificação a Detalhar no `/egm-draft`

* Catálogo fechado de entidades, relacionamentos e metadados dos Níveis 1 e 2 + regras completas de ciclo de vida do `Boundary Binding` (renomeação, alteração, exclusão e diagnóstico de órfãos).
* Contrato formal do schema JSON `v1` (DTO separado do domínio em memória), limites numéricos exatos de arquivo/cardinalidade e política de migração/backup.
* Catálogo exato de validadores determinísticos do MVP, severidades, estrutura de `Diagnostic` e matriz de testes sobre modelos válidos, modelos com defeitos injetados e os 2 sistemas reais.
* Especificação formal do ADR-001 (contratos, adapters, Composition Root e configuração de verificação de fronteiras em lint/CI) e do plano incremental de entregas.
