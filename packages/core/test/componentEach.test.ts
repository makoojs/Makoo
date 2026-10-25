import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterMountParams, MountAdapter } from '../src';
import {
	type ComponentEachInjection,
	createMakoo,
	type InjectionCommand,
	inject,
	injectEach,
	listen,
	MakooErrorCode,
	type MakooRuntime
} from '../src';

describe('injectEach', () => {
	const handles: InjectionCommand[] = [];
	beforeEach(() => {
		document.body.replaceChildren();
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(async () => {
		for (const handle of handles.splice(0)) await handle.remove().catch(() => {});
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	function adapter(
		mount: MountAdapter['mount'],
		unmount: MountAdapter['unmount'] = () => {}
	): MountAdapter {
		return { name: 'plain', mount, unmount };
	}

	function addBadge(id: string): HTMLElement {
		const el = document.createElement('span');
		el.className = 'badge';
		el.dataset.id = id;
		document.body.append(el);
		return el;
	}

	function eachInjection(core: MakooRuntime, name: string): ComponentEachInjection {
		const bag = core.injection(name);
		if (bag.kind !== 'component-each') {
			throw new Error(`expected component-each: ${name}`);
		}
		return bag;
	}

	it('declares without touching the DOM and omits listeners, reinject, and timeout', () => {
		const component = { id: 'Badge' };
		const props = { label: 'x' };
		vi.stubGlobal('document', undefined);
		const declaration = injectEach({
			name: 'badges',
			injectAt: '.badge',
			adapter: 'plain',
			component,
			props
		});
		vi.unstubAllGlobals();

		expect(declaration).toEqual({
			kind: 'component-each',
			name: 'badges',
			injectAt: '.badge',
			adapter: 'plain',
			component,
			props
		});
		expect('listeners' in declaration).toBe(false);
		expect('reinject' in declaration).toBe(false);
		expect('timeout' in declaration).toBe(false);
	});

	it('shares the top-level name space with inject and listen', () => {
		const core = createMakoo();
		core.useAdapter(adapter(() => 'h'));
		core.apply([inject({ name: 'taken', injectAt: '#x', adapter: 'plain', component: {} })]);
		handles.push(core.injection('taken').command);
		expect(() =>
			core.apply([
				injectEach({ name: 'taken', injectAt: '.badge', adapter: 'plain', component: {} })
			])
		).toThrow(expect.objectContaining({ code: MakooErrorCode.INJECTION_NAME_CONFLICT }));
		expect(() =>
			core.apply([
				injectEach({ name: 'also', injectAt: '.badge', adapter: 'plain', component: {} }),
				listen({ name: 'also', listenAt: '#x', type: 'click', callback() {} })
			])
		).toThrow(expect.objectContaining({ code: MakooErrorCode.INJECTION_NAME_CONFLICT }));
	});

	it('auto-starts into collecting with zero matches and does not time out', async () => {
		const core = createMakoo();
		const mount = vi.fn(() => 'h');
		core.useAdapter(adapter(mount));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		expect(badges.kind).toBe('component-each');
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
		expect(badges.children).toEqual([]);
		expect('children' in core.injection('badges')).toBe(true);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mount).not.toHaveBeenCalled();
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
		expect(badges.statusHandle.lastError).toBeUndefined();
	});

	it('mounts every current match in document order with one shared props reference', () => {
		const first = addBadge('a');
		const second = addBadge('b');
		const props = { shared: true };
		const mounts: AdapterMountParams[] = [];
		const core = createMakoo();
		core.useAdapter(
			adapter((params) => {
				mounts.push(params);
				return params.container;
			})
		);
		core.apply([
			injectEach({
				name: 'badges',
				injectAt: '.badge',
				adapter: 'plain',
				component: { id: 'Badge' },
				props
			})
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		expect(badges.kind).toBe('component-each');
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
		expect(badges.children).toHaveLength(2);
		expect(mounts).toHaveLength(2);
		expect(mounts[0]?.container.parentElement).toBe(first);
		expect(mounts[1]?.container.parentElement).toBe(second);
		expect(mounts[0]?.props).toBe(props);
		expect(mounts[1]?.props).toBe(props);
		expect(mounts[0]?.injection).toBe(badges.children[0]);
		expect(mounts[1]?.injection).toBe(badges.children[1]);
		expect(mounts[0]?.injection.command).toBe(badges.children[0]?.command);
		expect(mounts[0]?.injection.statusHandle).toBe(badges.children[0]?.statusHandle);
		expect(badges.children[0]?.statusHandle.getSnapshot()).toBe('mounted');
		expect(badges.children[1]?.statusHandle.getSnapshot()).toBe('mounted');
	});

	it('omits children on single-match component bags', () => {
		const host = document.createElement('section');
		host.id = 'host';
		document.body.append(host);
		addBadge('only');
		const core = createMakoo();
		core.useAdapter(adapter(() => 'h'));
		core.apply([
			inject({ name: 'panel', injectAt: '#host', adapter: 'plain', component: {} }),
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		handles.push(core.injection('panel').command, core.injection('badges').command);
		expect(core.injection('panel').kind).toBe('component');
		expect('children' in core.injection('panel')).toBe(false);
		expect(core.injection('badges').kind).toBe('component-each');
		expect('children' in core.injection('badges')).toBe(true);
	});

	it('returns a shallow children snapshot that does not mutate when membership changes', async () => {
		addBadge('a');
		const core = createMakoo();
		core.useAdapter(adapter(({ container }: AdapterMountParams) => container));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		const firstSnapshot = badges.children;
		expect(firstSnapshot).toHaveLength(1);
		const child = firstSnapshot[0];
		addBadge('b');
		await vi.waitFor(() => expect(badges.children).toHaveLength(2), { interval: 1 });
		expect(firstSnapshot).toHaveLength(1);
		expect(firstSnapshot[0]).toBe(child);
		expect(badges.children).not.toBe(firstSnapshot);
		expect(badges.children[0]).toBe(child);
	});

	it('drops an ended child from later snapshots; stale stop stays idempotent', async () => {
		addBadge('a');
		addBadge('b');
		const core = createMakoo();
		core.useAdapter(adapter(({ container }: AdapterMountParams) => container));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		const [first, second] = badges.children;
		expect(badges.children).toHaveLength(2);
		if (!first || !second) throw new Error('expected two children');
		await first.command.stop();
		expect(first.statusHandle.getSnapshot()).toBe('idle');
		expect(badges.children).toHaveLength(1);
		expect(badges.children[0]).toBe(second);
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
		await first.command.stop();
		expect(Object.keys(first.command).sort()).toEqual(['name', 'stop']);
		expect(first.statusHandle.getSnapshot()).toBe('idle');
	});

	it('skips a failed child element for the rest of the group run without failing the group', async () => {
		addBadge('a');
		addBadge('b');
		const core = createMakoo();
		core.useAdapter(
			adapter(({ container }: AdapterMountParams) => {
				if (container.parentElement?.getAttribute('data-id') === 'a') {
					throw new Error('bad host');
				}
				return container;
			})
		);
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
		expect(badges.statusHandle.lastError).toBeUndefined();
		expect(badges.children).toHaveLength(1);
		expect(badges.children[0]?.statusHandle.getSnapshot()).toBe('mounted');
		await vi.waitFor(() => expect(document.querySelectorAll('.badge div')).toHaveLength(1), {
			interval: 1
		});
		await badges.command.stop();
		expect(badges.statusHandle.getSnapshot()).toBe('idle');
	});

	it('puts a stopped child element in the skip set so restart of that bag cannot remount it', async () => {
		const host = addBadge('a');
		const core = createMakoo();
		const mount = vi.fn(({ container }: AdapterMountParams) => container);
		core.useAdapter(adapter(mount));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		const child = badges.children[0];
		if (!child) throw new Error('expected a child');
		await child.command.stop();
		expect(badges.children).toHaveLength(0);
		expect(mount).toHaveBeenCalledOnce();
		expect(host.querySelector('div')).toBeNull();
		expect(child.command).not.toHaveProperty('start');
		expect(child.command).not.toHaveProperty('remove');
		expect(mount).toHaveBeenCalledOnce();
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
	});

	it('ends only the detached child and keeps the group collecting', async () => {
		const first = addBadge('a');
		addBadge('b');
		const core = createMakoo();
		core.useAdapter(adapter(({ container }: AdapterMountParams) => container));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		const [childA, childB] = badges.children;
		if (!childA || !childB) throw new Error('expected two children');
		first.remove();
		await vi.waitFor(() => expect(badges.children).toHaveLength(1), { interval: 1 });
		expect(badges.children[0]).toBe(childB);
		expect(childA.statusHandle.getSnapshot()).toBe('failed');
		expect(childA.statusHandle.lastError).toMatchObject({
			code: MakooErrorCode.MOUNT_TARGET_DETACHED
		});
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
		expect(badges.statusHandle.lastError).toBeUndefined();
	});

	it('stays failed after a group-level collection failure', async () => {
		const core = createMakoo();
		core.useAdapter(adapter(({ container }: AdapterMountParams) => container));
		core.apply([
			injectEach({ name: 'badges', injectAt: '[[[', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		await Promise.resolve();
		expect(badges.statusHandle.getSnapshot()).toBe('failed');
		expect(badges.statusHandle.lastError).toMatchObject({ code: MakooErrorCode.MOUNT_FAILED });
		await badges.command.stop();
		expect(badges.statusHandle.getSnapshot()).toBe('idle');
	});

	it('keeps the group registered when remove lands while a stop is still cleaning up', async () => {
		addBadge('a');
		const core = createMakoo();
		core.useAdapter(
			adapter(
				({ container }: AdapterMountParams) => container,
				() => {
					throw new Error('unmount failed');
				}
			)
		);
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		const stopping = badges.command.stop();
		const removing = badges.command.remove();
		expect(core.injection('badges')).toBe(badges);
		await expect(stopping).rejects.toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED
		});
		await expect(removing).rejects.toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED
		});
		expect(core.injection('badges')).toBe(badges);
		expect(badges.statusHandle.getSnapshot()).toBe('failed');
	});

	it('lets a stop issued during a collection failure cleanup decide the final status', async () => {
		addBadge('a');
		let stopping: Promise<void> | undefined;
		const core = createMakoo();
		core.useAdapter(
			adapter(
				({ container }: AdapterMountParams) => container,
				() => {
					stopping = badges.command.stop();
				}
			)
		);
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		vi.spyOn(document, 'querySelectorAll').mockImplementation(() => {
			throw new SyntaxError('bad selector');
		});
		addBadge('b');
		await vi.waitFor(() => expect(stopping).toBeDefined(), { interval: 1 });
		await stopping;
		await Promise.resolve();
		expect(badges.statusHandle.getSnapshot()).toBe('idle');
		expect(badges.statusHandle.lastError).toMatchObject({ code: MakooErrorCode.MOUNT_FAILED });
	});

	it('defers a start issued while a stop is cleaning up until cleanup finishes', async () => {
		addBadge('a');
		const mount = vi.fn(({ container }: AdapterMountParams) => container);
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(adapter(mount, unmount));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		const stopping = badges.command.stop();
		badges.command.start();
		expect(mount).toHaveBeenCalledOnce();
		await stopping;
		expect(unmount).toHaveBeenCalledOnce();
		expect(mount).toHaveBeenCalledTimes(2);
		expect(badges.children).toHaveLength(1);
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
	});

	it('collects newly matching targets while the group stays collecting', async () => {
		addBadge('a');
		const mounts: HTMLElement[] = [];
		const core = createMakoo();
		core.useAdapter(
			adapter(({ container }: AdapterMountParams) => {
				mounts.push(container);
				return container;
			})
		);
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		expect(badges.children).toHaveLength(1);
		const firstChild = badges.children[0];
		const late = addBadge('b');
		await vi.waitFor(() => expect(badges.children).toHaveLength(2), { interval: 1 });
		expect(badges.children[0]).toBe(firstChild);
		expect(mounts[1]?.parentElement).toBe(late);
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
	});

	it('keeps children in document order when a new match is inserted between existing ones', async () => {
		const first = addBadge('a');
		const third = addBadge('c');
		const mounts: HTMLElement[] = [];
		const core = createMakoo();
		core.useAdapter(
			adapter(({ container }: AdapterMountParams) => {
				mounts.push(container);
				return container;
			})
		);
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		expect(badges.children).toHaveLength(2);
		const [childA, childC] = badges.children;
		const middle = document.createElement('span');
		middle.className = 'badge';
		middle.dataset.id = 'b';
		first.after(middle);
		await vi.waitFor(() => expect(badges.children).toHaveLength(3), { interval: 1 });
		expect(badges.children[0]).toBe(childA);
		expect(badges.children[2]).toBe(childC);
		expect(badges.children[1]).not.toBe(childA);
		expect(badges.children[1]).not.toBe(childC);
		expect(mounts.some((container) => container.parentElement === middle)).toBe(true);
		expect(
			first.compareDocumentPosition(middle) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			middle.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
	});

	it('clears the skip set on group stop then start so a failed host can remount', async () => {
		addBadge('a');
		addBadge('b');
		let failA = true;
		const core = createMakoo();
		const mount = vi.fn(({ container }: AdapterMountParams) => {
			if (failA && container.parentElement?.getAttribute('data-id') === 'a') {
				throw new Error('bad host');
			}
			return container;
		});
		core.useAdapter(adapter(mount));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		expect(badges.children).toHaveLength(1);
		await badges.command.stop();
		failA = false;
		mount.mockClear();
		badges.command.start();
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
		expect(badges.children).toHaveLength(2);
		expect(mount).toHaveBeenCalledTimes(2);
	});

	it('does not remount a stopped child until the group is restarted', async () => {
		const host = addBadge('a');
		const core = createMakoo();
		const mount = vi.fn(({ container }: AdapterMountParams) => container);
		core.useAdapter(adapter(mount));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		handles.push(badges.command);
		const stopped = badges.children[0];
		if (!stopped) throw new Error('expected a child');
		await stopped.command.stop();
		expect(badges.children).toHaveLength(0);
		host.append(document.createElement('i'));
		await Promise.resolve();
		expect(badges.children).toHaveLength(0);
		expect(mount).toHaveBeenCalledOnce();
		await badges.command.stop();
		badges.command.start();
		expect(badges.children).toHaveLength(1);
		expect(mount).toHaveBeenCalledTimes(2);
	});

	it('stops and removes the group, cleaning all live children', async () => {
		addBadge('a');
		addBadge('b');
		const unmount = vi.fn();
		const core = createMakoo();
		core.useAdapter(adapter(({ container }: AdapterMountParams) => container, unmount));
		core.apply([
			injectEach({ name: 'badges', injectAt: '.badge', adapter: 'plain', component: {} })
		]);
		const badges = eachInjection(core, 'badges');
		const command = badges.command;
		expect(badges.children).toHaveLength(2);
		await command.stop();
		expect(unmount).toHaveBeenCalledTimes(2);
		expect(badges.statusHandle.getSnapshot()).toBe('idle');
		expect(badges.children).toHaveLength(0);
		command.start();
		expect(badges.statusHandle.getSnapshot()).toBe('collecting');
		expect(badges.children).toHaveLength(2);
		await command.remove();
		expect(() => core.injection('badges')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		expect(() => command.start()).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_REMOVED })
		);
	});
});
