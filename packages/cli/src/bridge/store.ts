import type { RuntimeSnapshot } from '../vite/session';
import type { PageRuntimeRow } from './protocol';

/**
 * Node-side table of per-page runtime state. The devframe bridge writes whole
 * page tables keyed by connection id; the terminal reads the projection.
 */
export class RuntimeStore {
	private readonly pages = new Map<number, PageRuntimeRow[]>();
	private onChange: (() => void) | null = null;

	public replacePage(connectionId: number, rows: PageRuntimeRow[]): void {
		this.pages.set(connectionId, rows);
		this.onChange?.();
	}

	public disconnect(connectionId: number): void {
		if (this.pages.delete(connectionId)) {
			this.onChange?.();
		}
	}

	public subscribe(onChange: () => void): () => void {
		this.onChange = onChange;
		return () => {
			if (this.onChange === onChange) this.onChange = null;
		};
	}

	public getRuntimeSnapshots(): RuntimeSnapshot[] {
		return [...this.pages.entries()].flatMap(([clientId, rows]) =>
			rows.map((row) => ({ clientId, ...row }))
		);
	}
}
