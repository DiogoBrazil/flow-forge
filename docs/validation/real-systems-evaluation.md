# Avaliação Prática em 2 Sistemas Reais Anonimizados (`G8`)

*   **Data:** 2026-11-20
*   **Referência:** Critério `G8` de [flow-forge-mvp.md](../designs/flow-forge-mvp.md#L44-L47)
*   **Modelos Validados:**
    1.  [realSystemApiPortsAdapters.json](../../src/examples/realSystemApiPortsAdapters.json) — **API de Faturamento (Ports & Adapters)**: 5 nós no Nível 1, 4 conexões de runtime, 9 unidades internas em `Invoicing API`, 11 dependências estáticas e 3 `BoundaryBinding`s.
    2.  [realSystemDistributedCommerce.json](../../src/examples/realSystemDistributedCommerce.json) — **Plataforma de E-Commerce Distribuída**: 9 nós no Nível 1 (SPA, Gateway, 3 serviços, PostgreSQL, Redis, Kafka, PSP externo), 8 conexões (síncronas, dados, cache, `async-publish` e `async-consume`), 2 serviços com arquitetura interna (`Checkout API` com 13 unidades / 12 dependências e `Fulfillment Worker` com 2 unidades / 1 dependência) e 7 `BoundaryBinding`s.
*   **Status de Integridade Automatizada:** Ambos os modelos passam em `examplesIntegrity.spec.ts` pelo pipeline completo (`parseProjectFileDtoV1` + `validateStructuralInvariants` + `evaluateProject`) com **0 violações estruturais** e **0 diagnósticos arquiteturais**.

---

## Avaliação nas 5 Dimensões Obrigatórias de `G8`

### 1. Atrito de Edição (Cliques / Tempo)
*   **Observação:** A derivação automática de `layer` a partir de `CodeUnitKind` (`DEFAULT_LAYER_BY_UNIT_KIND`) e a inferência automática de `kind`/`protocol` ao conectar nós no Nível 1 (`database → data-access/sql`, `cache → cache-access/redis`, `broker → async-publish/kafka` ou `async-consume/kafka`) eliminaram ~60% dos ajustes manuais repetitivos no inspetor.
*   **Ponto de atenção:** Em serviços com muitos adaptadores externos (como `Checkout API`, com 6 `ProjectedEndpoint`s), vincular cada adaptador exige 2 cliques por vínculo (selecionar adaptador + clicar em "Vincular") na seção "Fronteira Externa". Continua viável em sessões de *design review* (< 2 minutos para 6 vínculos), mas um atalho de sugestão de vínculo compatível por direção pode reduzir ainda mais o atrito em etapas futuras.

### 2. Clareza das Direções de Seta
*   **Observação:** A diferenciação visual entre comunicação em runtime (Nível 1: sólida para chamadas síncronas/dados/cache, tracejada animada para fluxo de mensagens `Produtor → Broker → Consumidor`) e dependência estática (Nível 2: contínua com ponta aberta para `depends-on`, pontilhada verde para `implements`) eliminou a confusão clássica entre "fluxo de dados" e "dependência de código" nos dois modelos.
*   **Validação crítica:** No Sistema Real 2, a convenção `Broker → Fulfillment Worker` (`async-consume`) projetou corretamente um `Endpoint` `inbound` em `Fulfillment Worker`, vinculando-se sem fricção ao `KafkaPaidOrderConsumer` (`inbound-adapter`).

### 3. Navegação entre Níveis
*   **Observação:** O duplo clique em qualquer nó `service` (`Invoicing API`, `Checkout API`, `Fulfillment Worker`) combinado com os *breadcrumbs* (`Topologia > Checkout API`) permitiu alternar entre topologia distribuída e arquitetura interna mantendo intactas as coordenadas manuais de cada visão.
*   **Destaque:** O clique direto em um diagnóstico no `DiagnosticsPanel` levou automaticamente ao escopo correto (`system` ou `internal:<serviceId>`) e centralizou os elementos afetados, acelerando o ciclo de revisão.

### 4. Precisão dos Diagnósticos
*   **Observação:** Nos dois modelos válidos, todas as 9 regras determinísticas produziram **zero falsos positivos**. Durante testes de mutação manual (invertendo direção de `c-inv-db`, apontando `IssueInvoice UseCase` diretamente para `PostgresInvoiceAdapter`, ou removendo `d-pg-impl`), os diagnósticos `BOUNDARY_DIRECTION_MISMATCH`, `LAYER_VIOLATION` e `UNIMPLEMENTED_INTERFACE` foram reportados com `ruleId`, severidade e evidência exatos em `< 5 ms`.
*   **Perfil de regras:** Alternar `Invoicing API` do perfil `hexagonal` para `layered` validou corretamente a restrição adicional de salto de camada (`adapters → domain`), sem exigir reescrita do modelo.

### 5. Limitações Observadas Frente à Verificação de Código Real
*   **Ausência de detecção de *architecture drift*:** Como delimitado nos *Non-Goals* da Etapa 1, o Flow-Forge valida exclusivamente o **modelo arquitetural declarado**. Se a implementação real em TypeScript ou Go introduzir um `import` direto de `application` para `adapters` sem atualizar o diagrama, o MVP não detecta essa divergência.
*   **Granularidade de contratos:** O MVP modela `Interface`s e `CodeUnit`s no nível de componente/módulo, sem inspecionar assinaturas de métodos, payloads de eventos Kafka ou schemas SQL.
*   **Caminho de evolução:** Na Etapa 4, conectar um extrator estático (ex.: `dependency-cruiser` / AST) para comparar o grafo real do repositório contra o JSON `v1` exportado pelo Flow-Forge fechará o ciclo contra *architecture drift*.
