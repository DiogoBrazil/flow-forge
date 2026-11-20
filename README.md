# Flow-Forge

Aplicação web *local-first* para modelagem visual multinível, navegação hierárquica (*drill-down*) e validação estrutural determinística de arquiteturas de software e sistemas distribuídos durante concepção e *design review*.

## Documentação Técnica

*   [Especificação de Design Técnico (MVP / Etapa 1)](./docs/designs/flow-forge-mvp.md)
*   [ADR-001 — Inversão de Dependências (DIP / Ports & Adapters)](./docs/adr/ADR-001-dependency-inversion-ports-adapters.md)
*   [Relatório da Fatia 0 — Spike Técnica](./docs/validation/spike-0-report.md)

## Arquitetura Modular

```text
src/
  domain/           # Entidades imutáveis, limites, invariantes, projeções e comandos puros (zero deps)
  rules/            # Validadores arquiteturais determinísticos (Tarjan + 9 regras; só importa domain)
  schemas/          # Schema JSON v1 (Zod ^4.3.0) e serialização determinística
  examples/         # Fixtures JSON v1 e sistemas reais anonimizados (zero imports)
  application/      # Casos de uso, SnapshotHistory (Undo/Redo) e Ports (ProjectRepository, LayoutPort)
  storage/          # Adapter IndexedDB (idb) implementando ProjectRepository
  layout/           # Adapter @dagrejs/dagre implementando LayoutPort
  diagram-adapter/  # Projeção de ViewModel e composable @xyflow/vue v2
  composition/      # Composition Root (createAppContainer)
  ui/               # Interface Vue 3 + composable useWorkspace
```

## Comandos Principais

```bash
npm install
npm run typecheck         # vue-tsc --noEmit (strict + exactOptionalPropertyTypes)
npm run lint              # ESLint (TypeScript + Vue + vue/no-v-html)
npm run depcruise         # Verificação das fronteiras da ADR-001
npm run test:unit         # Testes unitários em Node puro (Vitest)
npm run test:coverage     # Cobertura v8 com limiares no núcleo
npm run test:integration  # Testes de integração (storage + diagram)
npm run dev               # Servidor de desenvolvimento Vite
npm run build             # Build de produção
npm run test:e2e          # Testes E2E Playwright sobre vite preview
```
