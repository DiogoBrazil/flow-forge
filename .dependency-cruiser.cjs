/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Proíbe ciclos de dependência entre módulos do Flow-Forge (ADR-001).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'src/domain/ não pode importar nenhum outro módulo interno nem pacotes npm (ADR-001).',
      from: { path: '^src/domain/' },
      to: {
        pathNot: '^src/domain/',
      },
    },
    {
      name: 'rules-only-domain',
      severity: 'error',
      comment: 'src/rules/ só pode importar src/rules/ e src/domain/ (zero pacotes npm).',
      from: { path: '^src/rules/' },
      to: {
        pathNot: '^src/(rules|domain)/',
      },
    },
    {
      name: 'schemas-only-domain-and-zod',
      severity: 'error',
      comment: 'src/schemas/ só pode importar src/schemas/, src/domain/ e zod.',
      from: { path: '^src/schemas/' },
      to: {
        pathNot: ['^src/(schemas|domain)/', '^node_modules/zod(/|$)'],
      },
    },
    {
      name: 'examples-no-imports',
      severity: 'error',
      comment: 'src/examples/ contém apenas JSON bruto e metadados, sem imports externos ou de outros módulos.',
      from: { path: '^src/examples/' },
      to: {
        pathNot: '^src/examples/',
      },
    },
    {
      name: 'application-allowed-boundaries',
      severity: 'error',
      comment:
        'src/application/ só pode importar domain, rules, schemas e examples; proibido Vue, @xyflow, idb, dagre, storage, layout, diagram-adapter, ui e composition.',
      from: { path: '^src/application/' },
      to: {
        pathNot: '^src/(application|domain|rules|schemas|examples)/',
      },
    },
    {
      name: 'storage-boundaries',
      severity: 'error',
      comment: 'src/storage/ só pode importar application/ports, domain, schemas e idb.',
      from: { path: '^src/storage/' },
      to: {
        pathNot: ['^src/(storage|domain|schemas)/', '^src/application/ports/', '^node_modules/idb(/|$)'],
      },
    },
    {
      name: 'layout-boundaries',
      severity: 'error',
      comment: 'src/layout/ só pode importar application/ports, domain e @dagrejs/dagre.',
      from: { path: '^src/layout/' },
      to: {
        pathNot: ['^src/(layout|domain)/', '^src/application/ports/', '^node_modules/@dagrejs/dagre(/|$)'],
      },
    },
    {
      name: 'diagram-adapter-boundaries',
      severity: 'error',
      comment: 'src/diagram-adapter/ não pode importar idb, storage, layout ou composition.',
      from: { path: '^src/diagram-adapter/' },
      to: {
        path: ['^src/(storage|layout|composition)/', '^node_modules/(idb|@dagrejs/dagre)(/|$)'],
      },
    },
    {
      name: 'ui-boundaries',
      severity: 'error',
      comment: 'src/ui/ não pode importar storage, layout, composition, idb ou @dagrejs/dagre.',
      from: { path: '^src/ui/' },
      to: {
        path: ['^src/(storage|layout|composition)/', '^node_modules/(idb|@dagrejs/dagre)(/|$)'],
      },
    },
    {
      name: 'composition-no-ui-or-vue',
      severity: 'error',
      comment: 'src/composition/ não pode importar src/ui/, vue ou @xyflow/vue.',
      from: { path: '^src/composition/' },
      to: {
        path: ['^src/ui/', '^node_modules/(vue|@xyflow/vue)(/|$)'],
      },
    },
    {
      name: 'main-ts-boundaries',
      severity: 'error',
      comment: 'src/main.ts não pode importar diretamente storage, layout, idb ou @dagrejs/dagre.',
      from: { path: '^src/main\\.ts$' },
      to: {
        path: ['^src/(storage|layout)/', '^node_modules/(idb|@dagrejs/dagre)(/|$)'],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.js', '.vue'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
