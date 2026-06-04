import type { MountAdapter, ResolvableMountAdapter } from './types';

export class AdapterRegistry {
	private readonly adapters: ResolvableMountAdapter[] = [];

	public resolve(artifact: unknown): MountAdapter | undefined {
		const resolvedAdapter = this.adapters.find((adapter) => adapter.matches(artifact));
		return resolvedAdapter;
	}

	public use(adapter: ResolvableMountAdapter): void {
		if (this.adapters.includes(adapter)) return;
		this.adapters.push(adapter);
	}
}
