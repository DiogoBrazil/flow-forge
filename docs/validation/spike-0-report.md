# Relatório da Fatia 0 — Spike Técnica Descartável

*   **Data:** 2026-11-20
*   **Referência:** [flow-forge-mvp.md](../designs/flow-forge-mvp.md#L581-L592) (Seção 7 — Portão Técnico Pré-Implementação)
*   **Ambiente de Execução:** Linux, Node `v24.20.0`, npm `11.19.0`, Chromium Headless (`chromium_headless_shell-1248`) contra build de produção (`vite build` + `vite preview`).
*   **Diretório Descartável:** `/tmp/flow-forge-spike-0` (removido após coleta das evidências).

---

## 1. Resumo Executivo e Recomendação (`Go / Pivot`)

| Questão Aberta | Decisão Recomendada | Justificativa Objetiva |
| :--- | :---: | :--- |
| **`OQ1` — Motor de Canvas** | **GO — `@xyflow/vue` `^2.0.2`** | Todos os 5 critérios aprovados com folga (0 erros de console/página, fluxo unidirecional comprovado, `vue-tsc` verde com `exactOptionalPropertyTypes: true`, max frame `16,8 ms` em 300 nós). **Não** há gatilho de pivot para `@xyflow/react`. |
| **`OQ2` — Motor de Layout (`LayoutPort`)** | **GO — `@dagrejs/dagre` `^3.1.3` (síncrono, sem Web Worker)** | Executou em **31,1 ms** (50 nós, meta `<= 150 ms`) e **125,4 ms** (300 nós, meta `<= 500 ms`), com **0 sobreposições** e bundle JS total de **421,91 kB (138,55 kB gzip)** — economizando ~1,49 MB frente ao `elkjs` (`1.912,84 kB`) e eliminando a complexidade de Web Worker/stub. |

---

## 2. Versões Avaliadas na Spike

| Pacote | Versão Testada | Observações |
| :--- | :--- | :--- |
| `@xyflow/vue` | `2.0.2` | `peerDependencies` exige `vue: "^3.5.27"`. Exporta `@xyflow/vue/style.css`. |
| `@dagrejs/dagre` | `3.1.3` | ESM nativo, zero sobreposição nos testes. |
| `elkjs` (comparativo) | `0.12.1` | Testado via `elkjs/lib/elk.bundled.js` sem Worker apenas para comparação de latência e bundle. |
| `zod` | `4.6.7` (`^4.3.0`) | `z.strictObject` + `.exactOptional()` compatíveis com `exactOptionalPropertyTypes: true`. |
| `idb` | `8.0.4` | Gravação e leitura no IndexedDB real do Chromium sem `DataCloneError`. |
| `vue-tsc` / `typescript` | `2.2.8` / `5.8.2` | `vue-tsc --noEmit` passou com **0 erros** com `exactOptionalPropertyTypes: true` global. |

---

## 3. Evidências Objetivas por Critério

### Critério 1 — Nós customizados, handles e setas diferenciadas
*   **Nível 1 (Topologia Distribuída):** 5 nós customizados (`ArchNode.vue`), 10 `<Handle>`s (`Position.Left` / `Position.Right`), 4 arestas com estilos distintos (`sync-call` sólida `#0f172a`, `data-access` sólida `#0369a1`, `async-publish` tracejada `6px, 4px` `#7c3aed`). **Sobreposições medidas no DOM:** `0`.
*   **Nível 2 (Arquitetura Interna):** 5 nós com badges contextuais de `Boundary Binding` renderizados (`← HTTP: API Gateway`, `→ SQL: PostgreSQL`, `⚠ Sem vínculo externo`), 3 arestas diferenciadas (`depends-on` sólida com ponta aberta, `implements` pontilhada `2px, 4px` `#059669`). **Sobreposições medidas no DOM:** `0`.
*   **Erros de runtime:** `0` `console.error`, `0` `pageerror`.
*   **Resultado:** **APROVADO**.

### Critério 2 — Fluxo unidirecional (`shallowRef`) + drill-down
*   **Arraste real de `orders-api` (Nível 1):**
    *   Commits de domínio antes do arraste: `0`.
    *   Durante o arraste: `isDragging === true`, `9` eventos `@nodes-change` aplicados apenas ao buffer local `shallowRef`, **0 commits de domínio**.
    *   Ao soltar (`@node-drag-stop`): `isDragging === false`, **exatamente `1` commit de domínio**, `getInternalNode('orders-api')?.measured` retornou `{ width: 220, height: 84 }`.
*   **Drill-down e preservação de posições:**
    *   Duplo clique (`@node-double-click`) em `orders-api` abriu o Nível 2 (`internal:orders-api`).
    *   Alternar `Nível 1 → Nível 2 → Nível 1 → Nível 2` preservou integralmente as posições arrastadas de ambos os níveis (`positionsPreservedAfterRoundTrip: true`).
*   **Resultado:** **APROVADO** *(com ajuste obrigatório de API registrado na Seção 4 abaixo)*.

### Critério 3 — Serialização (`structuredClone` / `idb`) e tipagem estrita
*   **Serialização pós-edição Vue:** `SpikeProjectSchema.parse(...)` → `structuredClone(project)` → `db.put('projects', cloned)` → `db.get('projects', 'proj-spike-1')` concluído com `ok: true` e **zero `DataCloneError`**.
*   **Tipagem estrita (`vue-tsc --noEmit`):**
    *   Flags ativas em `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
    *   Resultado: **0 erros** (não é necessário isolar `exactOptionalPropertyTypes` em `tsconfig.core.json`).
    *   Requisito confirmado: componentes de nó customizado devem declarar `defineProps<NodeProps<Node<ArchNodeData, 'arch'>>>()`.
*   **Resultado:** **APROVADO**.

### Critério 4 — Seleção de layout em `vite build` + `vite preview`

Benchmarks executados no Chromium sobre o bundle de produção (`vite preview`), nós `220×84`:

| Motor | Nós / Arestas | Tempo (ms) | Meta | Sobreposições |
| :--- | :---: | :---: | :---: | :---: |
| **`@dagrejs/dagre` `3.1.3`** | 50 / 82 | **31,1 ms** | `<= 150 ms` | **0** |
| `@dagrejs/dagre` `3.1.3` | 150 / 252 | **73,0 ms** | — | **0** |
| **`@dagrejs/dagre` `3.1.3`** | 300 / 507 | **125,4 ms** | `<= 500 ms` | **0** |
| `elkjs` `0.12.1` (direto) | 50 / 82 | 122,0 ms | `<= 150 ms` | 0 |
| `elkjs` `0.12.1` (direto) | 150 / 252 | 167,1 ms | — | 0 |
| `elkjs` `0.12.1` (direto) | 300 / 507 | 204,4 ms | `<= 500 ms` | 0 |

**Impacto no bundle de produção (`vite build`):**
*   **Somente `@dagrejs/dagre`:** `dist/assets/index-*.js` = **421,91 kB** (`138,55 kB` gzip), `index-*.css` = `16,06 kB` (`3,14 kB` gzip), build em **1,65 s**.
*   **Com `elkjs` embutido:** `dist/assets/index-*.js` = `1.912,84 kB` (`593,32 kB` gzip), build em `13,59 s`.
*   **Resultado:** **APROVADO** — congelar `src/layout/DagreLayoutAdapter.ts` com `@dagrejs/dagre` atrás de `LayoutPort`.

### Critério 5 — Estresse progressivo (50 / 150 / 300 nós)

Medição via `requestAnimationFrame` durante arraste de nó + zoom de roda + pan do canvas no Chromium (`vite preview`):

| Carga | Render inicial | Frames medidos | Média por frame | p95 | Máximo (Meta `< 200 ms`) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **50 nós** | 96 ms | 31 | 15,98 ms | 16,8 ms | **16,8 ms** |
| **150 nós** | 259 ms | 31 | 16,08 ms | 16,8 ms | **16,8 ms** |
| **300 nós** | 542 ms | 31 | 16,08 ms | 16,8 ms | **16,8 ms** |

*   **Resultado:** **APROVADO** (nenhum congelamento próximo ao limite de `200 ms`).

---

## 4. Adendo Técnico para a Fatia 4 (Descobertas da API real do `@xyflow/vue` v2.0.2)

A spike revelou 4 detalhes concretos da versão `2.0.2` que devem ser seguidos na implementação da Fatia 1 e da Fatia 4:

1.  **Usar `setupVueFlow()` em vez de `<VueFlowProvider>`:**
    *   No `@xyflow/vue@2.0.2`, o componente `<VueFlowProvider>` declara props booleanas (`nodesDraggable`, `nodesConnectable`, `elementsSelectable`, `panOnDrag`, `zoomOnScroll`, etc.) sem `default: undefined`. No Vue 3, props booleanas omitidas são coagidas para `false`, desativando silenciosamente arraste, conexão, seleção e pan/zoom.
    *   **Solução oficial da própria biblioteca:** chamar `setupVueFlow()` diretamente no `setup()` de `ArchitectureCanvas.vue` (que cria e provê a store com os defaults corretos `true` e retorna a mesma `VueFlowInstance` de `useVueFlow()`).
2.  **`@nodes-change` emite `NodeChangeset` (com `.applyTo(nodes)`):**
    *   No `@xyflow/vue@2.0.2`, não existe função solta `applyNodeChanges`. O evento `@nodes-change` entrega uma instância de `NodeChangeset` (de `@xyflow/system`), aplicada ao buffer `shallowRef` via `changes.applyTo(localNodes.value)`.
3.  **Versão mínima do Vue em `package.json`:**
    *   Fixar `vue: "^3.5.27"` na Fatia 1 para satisfazer `peerDependencies` de `@xyflow/vue@2.0.2` sem alertas.
4.  **Arquivos de layout congelados na Fatia 4:**
    *   Implementar apenas `src/layout/DagreLayoutAdapter.ts` (sem `elkWorkerClient.ts`, `ElkWorkerLayoutAdapter.ts`, `webWorkerStub.ts` nem alias `'web-worker'` no `vite.config.ts`).

---

## 5. Aprovação do Portão (Fatia 0 → Fatia 1)

*   [ ] **Aprovação do autor:** confirmar **GO** para `@xyflow/vue` `^2.0.2` (com `setupVueFlow()` + `NodeChangeset.applyTo()`) e `@dagrejs/dagre` `^3.1.3` (sem Web Worker) e autorizar o início da **Fatia 1**.
