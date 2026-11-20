# ADR-001: Inversão de Dependências (DIP / Ports & Adapters)

*   **Status:** Accepted
*   **Date:** 2026-11-20

## Contexto

O Flow-Forge é uma aplicação web *local-first* de modelagem visual multinível e validação arquitetural determinística. Para garantir testabilidade determinística em Node puro, longevidade do núcleo de domínio e troca segura de infraestrutura (IndexedDB, motor de layout e biblioteca de canvas), o código-fonte do próprio Flow-Forge adota **Inversão de Dependências (DIP / Ports & Adapters)** como restrição arquitetural permanente desde a Fatia 1.

## Decisão

1.  **Monólito modular em projeto único (Vite + TypeScript + Vue 3)** com dependências apontando estritamente das bordas para o núcleo (`src/domain/`).
2.  **Separação semântica explícita:** a direção de dependências do código-fonte do Flow-Forge (camadas externas dependendo de contratos internos) é independente do sentido das setas desenhadas pelo usuário nos diagramas.
3.  **Contratos formais (Ports em `src/application/ports/`):**
    *   `ProjectRepository` → implementação concreta em `src/storage/IndexedDBProjectRepository.ts` (`idb`), fake `InMemoryProjectRepository` em testes.
    *   `LayoutPort` → implementação concreta em `src/layout/DagreLayoutAdapter.ts` (`@dagrejs/dagre`, congelado na Fatia 0), fake `StubLayoutAdapter` em testes.
4.  **Sem abstrações artificiais:**
    *   Gerador de ID e relógio são funções opcionais com padrão nativo (`() => crypto.randomUUID()`, `() => new Date().toISOString()`).
    *   Serviços puramente determinísticos em memória (`src/domain/`, `src/rules/`, `src/schemas/`, `src/diagram-adapter/projection.ts`) são invocados diretamente sem interfaces de um único implementador.
    *   `src/application/` pode importar `src/schemas/` (validação/serialização pura) e `src/examples/` (JSON bruto + metadados, sem imports internos).
5.  **Composition Root único:** `src/composition/createAppContainer.ts` instancia os adapters concretos e os injeta nos casos de uso, sem container/framework de DI.

## Verificação Automatizada em CI

*   `npm run depcruise` (`.dependency-cruiser.cjs`, cobrindo `.ts`, `.js` e `.vue` com `tsPreCompilationDeps: true`) falha o build diante de qualquer violação da matriz de fronteiras ou ciclo entre módulos.
*   Toda a suíte `npm run test:unit` (`domain/`, `rules/`, `schemas/`, `application/`) executa em Node puro no Vitest, sem `jsdom`/`happy-dom`, sem IndexedDB real e sem montar componentes Vue.
