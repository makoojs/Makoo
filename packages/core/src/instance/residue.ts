import type { LockView } from '../runtime/injection';

type LockNode = {
	children: Map<string, LockNode>;
	elements?: WeakSet<Element>;
};

/**
 * Residue locks of one Core Instance: elements whose cleanup left residue, grouped by lock
 * key — a top-level injection name, or a nested group such as component name + attached
 * listener name. Locks outlive their injection, so a same-named re-application inherits them.
 */
export function createResidueLocks(): (key: string | readonly string[]) => LockView {
	const root: LockNode = { children: new Map() };

	const getOrCreate = (key: string | readonly string[]): WeakSet<Element> => {
		const parts = typeof key === 'string' ? [key] : key;
		let node = root;
		for (const part of parts) {
			let child = node.children.get(part);
			if (!child) {
				child = { children: new Map() };
				node.children.set(part, child);
			}
			node = child;
		}
		if (!node.elements) {
			node.elements = new WeakSet<Element>();
		}
		return node.elements;
	};

	return (key) => {
		const locks = getOrCreate(key);
		return {
			isLocked: (element) => locks.has(element),
			lock: (element) => locks.add(element)
		};
	};
}
