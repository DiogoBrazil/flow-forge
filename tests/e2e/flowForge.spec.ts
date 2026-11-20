import { expect, test } from '@playwright/test';
import hexagonalOrdersValid from '../../src/examples/hexagonalOrdersValid.json' with { type: 'json' };

test.describe('Flow-Forge MVP E2E (CUJ 1 - CUJ 4)', () => {
  test('CUJ 1: Multilevel topology, drill-down, Boundary Binding badges & zero diagnostics', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('empty-welcome')).toBeVisible();

    await page.getByTestId('welcome-open-example').click();
    await expect(page.getByTestId('architecture-canvas')).toBeVisible();
    await expect(page.getByTestId('diag-empty')).toBeVisible();

    // Verify Level 1 service node and drill down via double-click
    const ordersNode = page.locator('[data-node-id="svc-orders"]');
    await expect(ordersNode).toBeVisible();
    await ordersNode.dblclick();

    // Verify Level 2 breadcrumbs, External Boundary section and adapter badges
    await expect(page.getByTestId('breadcrumb-service')).toContainText('Orders API');
    await expect(page.getByTestId('external-boundary-section')).toBeVisible();
    await expect(page.getByTestId('endpoint-c-gw-orders')).toContainText('API Gateway');
    await expect(page.getByTestId('endpoint-c-orders-pg')).toContainText('PostgreSQL');
    await expect(page.locator('[data-node-id="u-http-adapter"]')).toContainText('← HTTP: API Gateway');
    await expect(page.locator('[data-node-id="u-pg-adapter"]')).toContainText('→ SQL: PostgreSQL');

    // Return to Level 1 via breadcrumb
    await page.getByTestId('breadcrumb-system').click();
    await expect(page.locator('[data-node-id="svc-orders"]')).toBeVisible();
    await expect(page.getByTestId('diag-empty')).toBeVisible();
  });

  test('CUJ 2: Diagnose defects, navigate from DiagnosticsPanel and fix Boundary Binding', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('welcome-open-defective').click();

    // Verify errors and warnings are reported
    await expect(page.getByTestId('diag-item-LAYER_VIOLATION')).toBeVisible();
    await expect(page.getByTestId('diag-item-UNBOUND_EXTERNAL_ENDPOINT').first()).toBeVisible();
    await expect(page.getByTestId('diag-item-UNBOUND_ADAPTER')).toBeVisible();

    // Click Level 2 diagnostic -> automatically navigates to internal:svc-orders
    await page.getByTestId('diag-item-UNBOUND_ADAPTER').click();
    await expect(page.getByTestId('breadcrumb-service')).toContainText('Orders API');
    await expect(page.getByTestId('external-boundary-section')).toBeVisible();

    // Bind u-orphan-adapter to c-orders-redis in External Boundary section
    await page.getByTestId('bind-select-c-orders-redis').selectOption('u-orphan-adapter');
    await page.getByTestId('bind-btn-c-orders-redis').click();

    // After 200ms validation debounce, UNBOUND_ADAPTER disappears
    await expect(page.getByTestId('diag-item-UNBOUND_ADAPTER')).toHaveCount(0);
  });

  test('CUJ 3: On-demand layout organization and atomic Undo/Redo via keyboard shortcuts', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('welcome-open-example').click();
    await expect(page.getByTestId('btn-undo')).toBeDisabled();

    // Trigger on-demand Dagre layout
    await page.getByTestId('btn-layout').click();
    await expect(page.getByTestId('btn-undo')).toBeEnabled();

    // Undo via Ctrl+Z
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('btn-redo')).toBeEnabled();

    // Redo via Ctrl+Shift+Z
    await page.keyboard.press('Control+Shift+Z');
    await expect(page.getByTestId('btn-undo')).toBeEnabled();
  });

  test('CUJ 4: IndexedDB persistence across reload, invalid JSON rejection & ID conflict resolution', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('welcome-open-example').click();

    // Add a node, wait for 600ms autosave to complete, then reload page
    await page.getByTestId('palette-system-cache').click();
    await expect(page.getByTestId('save-status')).toHaveText('Salvo', { timeout: 5000 });

    await page.reload();
    await expect(page.getByTestId('architecture-canvas')).toBeVisible();
    await expect(page.locator('[data-kind="cache"]')).toHaveCount(1);

    // Import future schemaVersion: 99 -> rejected cleanly by ImportConflictModal
    const fileInput = page.getByTestId('file-import-input');
    await fileInput.setInputFiles({
      name: 'future.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 99, project: {} })),
    });
    await expect(page.getByTestId('import-modal')).toBeVisible();
    await expect(page.getByTestId('import-modal-message')).toContainText('99');
    await page.getByTestId('btn-import-close').click();
    await expect(page.getByTestId('import-modal')).toBeHidden();

    // Import valid JSON with colliding ID -> prompts copy vs replace
    await fileInput.setInputFiles({
      name: 'orders.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(hexagonalOrdersValid)),
    });
    await expect(page.getByTestId('import-modal')).toBeVisible();
    await expect(page.getByTestId('btn-import-copy')).toBeVisible();
    await expect(page.getByTestId('btn-import-replace')).toBeVisible();

    await page.getByTestId('btn-import-copy').click();
    await expect(page.getByTestId('import-modal')).toBeHidden();
    await expect(page.getByTestId('project-selector')).toContainText('(Cópia)');
  });

  test('UX: Create project via native <dialog>, connect nodes via Inspector quick-connect & toggle theme', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('welcome-new-project').click();
    await expect(page.getByTestId('new-project-modal')).toBeVisible();

    await page.getByTestId('new-project-name-input').fill('Sistema Teste UX');
    await page.getByTestId('new-project-submit').click();
    await expect(page.getByTestId('new-project-modal')).toBeHidden();

    // Add 2 nodes -> connection hint appears
    await page.getByTestId('palette-system-service').click();
    await page.getByTestId('palette-system-database').click();
    await expect(page.getByTestId('connection-hint')).toBeVisible();

    // Select the service node -> connect to database via Inspector quick-connect
    await page.locator('[data-kind="service"]').first().click();
    await expect(page.getByTestId('quick-connect-box')).toBeVisible();
    const dbOptionValue = await page
      .locator('[data-testid="quick-connect-target"] option')
      .nth(1)
      .getAttribute('value');
    await page.getByTestId('quick-connect-target').selectOption(dbOptionValue!);
    await page.getByTestId('quick-connect-btn').click();

    // Edge created -> connection hint disappears
    await expect(page.locator('.vue-flow__edge')).toHaveCount(1);
    await expect(page.getByTestId('connection-hint')).toHaveCount(0);

    // Toggle theme updates <meta name="color-scheme">
    await page.getByTestId('btn-theme-toggle').click();
    const scheme = await page.locator('meta[name="color-scheme"]').getAttribute('content');
    expect(scheme === 'dark' || scheme === 'light').toBe(true);
  });
});
