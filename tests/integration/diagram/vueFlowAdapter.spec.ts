import { defineComponent, h, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { NodeChangeset } from '@xyflow/vue';
import { createAppContainer } from '@composition/createAppContainer';
import { projectToDiagramViewModel } from '@diagram-adapter/projection';
import { useVueFlowAdapter } from '@diagram-adapter/useVueFlowAdapter';
import type { DiagramViewModel } from '@diagram-adapter/viewModel';
import { BUILTIN_EXAMPLES } from '@examples/index';
import { evaluateProject } from '@rules/evaluateProject';
import { parseProjectFileDtoV1 } from '@schemas/projectFileV1';
import App from '@ui/App.vue';
import { APP_CONTAINER_KEY } from '@ui/composables/useWorkspace';
import { InMemoryProjectRepository } from '../../fakes/InMemoryProjectRepository';
import { StubLayoutAdapter } from '../../fakes/StubLayoutAdapter';

describe('Diagram adapter projection, VueFlowAdapter & recovery UI (happy-dom)', () => {
  it('projects Boundary Binding badges and differentiated edge styles in Level 1 and Level 2', () => {
    const validRaw = BUILTIN_EXAMPLES.find((e) => e.id === 'hexagonal-orders-valid')!.rawPayload;
    const parsed = parseProjectFileDtoV1(validRaw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const project = parsed.value.project;
    const diags = evaluateProject(project);

    const sysVm = projectToDiagramViewModel(project, { level: 'system' }, diags);
    expect(sysVm.nodes.find((n) => n.id === 'svc-orders')?.drillable).toBe(true);
    expect(sysVm.nodes.find((n) => n.id === 'db-postgres')?.drillable).toBe(false);
    expect(sysVm.edges.find((e) => e.id === 'c-orders-broker')?.styleKind).toBe('async-publish');
    expect(sysVm.edges.find((e) => e.id === 'c-broker-notif')?.styleKind).toBe('async-consume');

    const intVm = projectToDiagramViewModel(
      project,
      { level: 'internal', serviceId: 'svc-orders' },
      diags,
    );
    const httpAdapter = intVm.nodes.find((n) => n.id === 'u-http-adapter');
    expect(httpAdapter?.badges).toEqual([{ text: '← HTTP: API Gateway', variant: 'bound' }]);

    const pgAdapter = intVm.nodes.find((n) => n.id === 'u-pg-adapter');
    expect(pgAdapter?.badges).toEqual([{ text: '→ SQL: PostgreSQL', variant: 'bound' }]);

    expect(intVm.edges.find((e) => e.id === 'd-pg-repo-if')?.styleKind).toBe('implements');
    expect(intVm.edges.find((e) => e.id === 'd-http-uc')?.styleKind).toBe('depends-on');
  });

  it('locks external overwrites during drag, applies NodeChangeset locally and emits Proxy-free position only on node-drag-stop', async () => {
    const committed: Array<{ id: string; x: number; y: number }> = [];
    const vm = ref<DiagramViewModel>({
      nodes: [
        {
          id: 'n1',
          label: 'Orders API',
          kind: 'service',
          kindLabel: 'Service',
          position: { x: 10, y: 20 },
          drillable: true,
          badges: [],
          diagnosticSeverity: null,
          highlighted: false,
        },
      ],
      edges: [],
    });

    let exposedAdapter!: ReturnType<typeof useVueFlowAdapter>;
    const Harness = defineComponent({
      setup() {
        exposedAdapter = useVueFlowAdapter(vm, {
          onNodePositionCommitted: (id, pos) => {
            // Verify Proxy-free output via structuredClone
            const cloned = structuredClone(pos);
            committed.push({ id, x: cloned.x, y: cloned.y });
          },
          onConnectRequested: () => {},
          onNodeSelected: () => {},
          onEdgeSelected: () => {},
          onPaneSelected: () => {},
          onNodeDrillDown: () => {},
        });
        return () => h('div');
      },
    });

    const wrapper = mount(Harness);

    // Start dragging
    exposedAdapter.handleNodeDragStart({
      event: new MouseEvent('mousedown'),
      node: exposedAdapter.localNodes.value[0]!,
      nodes: exposedAdapter.localNodes.value,
    });
    expect(exposedAdapter.isDragging.value).toBe(true);

    // Apply local NodeChangeset during drag -> updates local buffer without committing
    const changes = new NodeChangeset([
      { id: 'n1', type: 'position', position: { x: 150, y: 260 }, dragging: true },
    ]);
    exposedAdapter.handleNodesChange(changes);
    expect(exposedAdapter.localNodes.value[0]?.position).toEqual({ x: 150, y: 260 });
    expect(committed).toHaveLength(0);

    // External viewModel update during drag MUST NOT overwrite local position
    vm.value = {
      ...vm.value,
      nodes: [{ ...vm.value.nodes[0]!, position: { x: 10, y: 20 } }],
    };
    await flushPromises();
    expect(exposedAdapter.localNodes.value[0]?.position).toEqual({ x: 150, y: 260 });

    // Terminal drag-stop emits single Proxy-free commit
    exposedAdapter.handleNodeDragStop({
      event: new MouseEvent('mouseup'),
      node: exposedAdapter.localNodes.value[0]!,
      nodes: exposedAdapter.localNodes.value,
    });
    expect(exposedAdapter.isDragging.value).toBe(false);
    expect(committed).toEqual([{ id: 'n1', x: 150, y: 260 }]);

    wrapper.unmount();
  });

  it('shows recovery banner on StorageQuotaError and RevisionConflictError without losing in-memory state', async () => {
    const repo = new InMemoryProjectRepository();
    const layoutPort = new StubLayoutAdapter();
    const container = createAppContainer({ projectRepo: repo, layoutPort });

    const wrapper = mount(App, {
      global: {
        provide: {
          [APP_CONTAINER_KEY as symbol]: container,
        },
      },
    });

    await flushPromises();
    expect(wrapper.find('[data-testid="empty-welcome"]').exists()).toBe(true);

    // Open built-in valid example
    await wrapper.find('[data-testid="welcome-open-example"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="diagnostics-panel"]').exists()).toBe(true);

    // Trigger QuotaExceededError on next save
    repo.failNextSaveWithQuota = true;
    await wrapper.find('[data-testid="palette-system-service"]').trigger('click');
    await new Promise((r) => setTimeout(r, 700));
    await flushPromises();

    const banner = wrapper.find('[data-testid="recovery-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('IndexedDB');
    expect(wrapper.find('[data-testid="btn-recovery-reload"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-recovery-download"]').exists()).toBe(true);

    // Reload from IndexedDB clears banner
    await wrapper.find('[data-testid="btn-recovery-reload"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="recovery-banner"]').exists()).toBe(false);

    // Simulate RevisionConflictError from another tab
    const activeId = container.session.currentProject!.id;
    const stored = await repo.load(activeId);
    repo.setRawRecord({ ...stored!, persistedRevision: 99 });

    await wrapper.find('[data-testid="palette-system-database"]').trigger('click');
    await new Promise((r) => setTimeout(r, 700));
    await flushPromises();

    expect(wrapper.find('[data-testid="recovery-banner"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="recovery-banner"]').text()).toContain('outra aba');

    wrapper.unmount();
  });
});
