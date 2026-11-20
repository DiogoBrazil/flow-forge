import type {
  LayoutGraphInput,
  LayoutGraphOutput,
  LayoutPort,
} from '@application/ports/LayoutPort';
import type { EntityId, Point2D } from '@domain/types';

export class StubLayoutAdapter implements LayoutPort {
  public delayMs = 0;
  public calls = 0;
  private pendingResolvers: Array<() => void> = [];
  public manualGate = false;

  async computeLayout(input: LayoutGraphInput): Promise<LayoutGraphOutput> {
    this.calls += 1;

    if (this.manualGate) {
      await new Promise<void>((resolve) => {
        this.pendingResolvers.push(resolve);
      });
    } else if (this.delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
    }

    const positions: Record<EntityId, Point2D> = {};
    input.nodes.forEach((node, index) => {
      positions[node.id] = { x: 100 + index * 300, y: 120 };
    });
    return { positions };
  }

  releasePending(): void {
    const resolvers = this.pendingResolvers;
    this.pendingResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
}
