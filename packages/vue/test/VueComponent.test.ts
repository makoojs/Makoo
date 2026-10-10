import {
	type ComponentCommand,
	type ComponentStatusHandle,
	createMakoo,
	type InjectionCommand,
	inject,
	type ListenerStatus,
	listen,
	MakooErrorCode,
	type MakooRuntime
} from '@makoojs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, type Ref, reactive, watchEffect } from 'vue';
import { createVueAdapter, useMakooComponent, VueErrorCode, type VueMakooComponent } from '../src';

function element(selector: string): HTMLElement {
	const target = document.querySelector<HTMLElement>(selector);
	if (!target) throw new Error(`Missing test element: ${selector}`);
	return target;
}

function addButton(id: string): HTMLButtonElement {
	const button = document.createElement('button');
	button.id = id;
	document.body.append(button);
	return button;
}

async function flush(): Promise<void> {
	await Promise.resolve();
	await nextTick();
}

describe('Vue components mounted by core', () => {
	const controls: InjectionCommand[] = [];
	let core: MakooRuntime;

	function panelCommand(): ComponentCommand {
		return core.command('panel');
	}

	function panelStatus(): ComponentStatusHandle {
		const status = core.statusHandle('panel');
		if (!('attachedListener' in status)) throw new Error('Expected a component');
		return status;
	}

	beforeEach(() => {
		document.body.innerHTML = '<section id="host"></section>';
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		core = createMakoo();
		core.useAdapter(createVueAdapter());
	});

	afterEach(async () => {
		for (const control of controls.splice(0)) await control.remove().catch(() => {});
		vi.restoreAllMocks();
		document.body.replaceChildren();
	});

	it('rejects component helpers outside a component mounted by the adapter', () => {
		expect(() => useMakooComponent()).toThrow(
			expect.objectContaining({ code: VueErrorCode.VUE_HOOK_OUTSIDE_COMPONENT })
		);
	});

	it('mounts the selected component with live props and its own component control', async () => {
		const store = reactive({ count: 1 });
		let received: VueMakooComponent | undefined;
		const Panel = defineComponent({
			props: {
				title: { type: String, required: true },
				store: { type: Object, required: true }
			},
			setup(props) {
				received = useMakooComponent();
				return () => h('p', `${props.title}:${(props.store as typeof store).count}`);
			}
		});

		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'vue',
				component: Panel,
				props: { title: 'Count', store }
			})
		]);
		controls.push(core.command('panel'));

		const container = element('#host').firstElementChild;
		expect(container?.textContent).toBe('Count:1');
		expect(received?.stop).toBe(core.command('panel').stop);
		expect(received?.status.value).toBe('mounted');
		expect(Object.isFrozen(store)).toBe(false);

		store.count = 2;
		await nextTick();
		expect(container?.textContent).toBe('Count:2');
	});

	it('shows attached listener waiting, binding and local recovery without remounting', async () => {
		let setups = 0;
		const Panel = defineComponent({
			setup() {
				setups += 1;
				const control = useMakooComponent();
				const play = control.attachedListener('play');
				const component = control.status;
				return () => h('p', `${component.value}/${play.value}`);
			}
		});

		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'vue',
				component: Panel,
				reinject: true,
				listeners: [
					listen({ name: 'play', listenAt: '#play', type: 'click', callback: vi.fn() })
				]
			})
		]);
		controls.push(core.command('panel'));
		await nextTick();
		const text = () => element('#host').textContent;
		expect(text()).toBe('mounted/waiting');

		addButton('play');
		await flush();
		expect(text()).toBe('mounted/bound');

		element('#play').remove();
		await flush();
		expect(text()).toBe('mounted/waiting');

		addButton('play');
		await flush();
		expect(text()).toBe('mounted/bound');
		expect(setups).toBe(1);
	});

	it('connects every attached listener before it is selected by name', async () => {
		let received: VueMakooComponent | undefined;
		const Panel = defineComponent({
			setup() {
				const control = useMakooComponent();
				received = control;
				return () =>
					h(
						'p',
						`${control.attachedListener('play').value}/${control.attachedListener('mute').value}`
					);
			}
		});
		core.apply([
			listen({ name: 'external', listenAt: '#host', type: 'click', callback: vi.fn() }),
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'vue',
				component: Panel,
				listeners: ['play', 'mute'].map((name) =>
					listen({ name, listenAt: `#${name}`, type: 'click', callback: vi.fn() })
				)
			})
		]);
		controls.push(core.command('panel'), core.command('external'));
		await nextTick();
		expect(element('#host').textContent).toBe('waiting/waiting');
		addButton('mute');
		await flush();
		expect(element('#host').textContent).toBe('waiting/bound');
		addButton('play');
		await flush();
		expect(element('#host').textContent).toBe('bound/bound');
		expect(received?.attachedListener('play')).toBe(received?.attachedListener('play'));
		expect(() => received?.attachedListener('external')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.LISTENER_NOT_FOUND })
		);
	});

	it('releases the old instance subscription when the component stops itself and restarts externally', async () => {
		const snapshots: Ref<ListenerStatus>[] = [];
		const Panel = defineComponent({
			setup() {
				const control = useMakooComponent();
				const play = control.attachedListener('play');
				snapshots.push(play);
				return () =>
					h('button', { class: 'close', onClick: () => control.stop() }, play.value);
			}
		});
		addButton('play');

		core.apply([
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'vue',
				component: Panel,
				listeners: [
					listen({ name: 'play', listenAt: '#play', type: 'click', callback: vi.fn() })
				]
			})
		]);
		controls.push(core.command('panel'));
		const panel = panelCommand();
		const status = panelStatus();
		const view = status.attachedListener('play');
		await nextTick();
		expect(element('#host .close').textContent).toBe('bound');

		element('#host .close').click();
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('idle'));
		expect(element('#host').childElementCount).toBe(0);
		const oldSnapshot = snapshots[0]?.value;

		panel.start();
		await nextTick();
		expect(snapshots).toHaveLength(2);
		expect(status.attachedListener('play')).toBe(view);
		expect(element('#host .close').textContent).toBe('bound');
		expect(snapshots[1]?.value).toBe(view.getSnapshot());

		element('#play').remove();
		await flush();
		expect(snapshots[0]?.value).toBe(oldSnapshot);
		expect(snapshots[1]?.value).toBe('failed');
	});

	it('blocks restart and removal when a failed Vue mount leaves component resources', async () => {
		const cause = new Error('child setup failed');
		const store = reactive({ count: 0 });
		const effect = vi.fn();
		const watchers: (() => void)[] = [];
		const Child = defineComponent({
			setup() {
				throw cause;
			}
		});
		const Panel = defineComponent({
			setup() {
				watchers.push(watchEffect(() => effect(store.count)));
				return () => h(Child);
			}
		});

		try {
			core.apply([
				inject({ name: 'panel', injectAt: '#host', adapter: 'vue', component: Panel })
			]);
			const panel = panelCommand();
			controls.push(panel);
			await vi.waitFor(() => expect(panelStatus().getSnapshot()).toBe('failed'));

			const diagnostic = panelStatus().lastError;
			expect(diagnostic).toMatchObject({
				code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
				errors: expect.arrayContaining([
					expect.objectContaining({ code: MakooErrorCode.MOUNT_FAILED, cause }),
					expect.objectContaining({ code: VueErrorCode.VUE_PARTIAL_MOUNT_UNCONFIRMED })
				])
			});
			expect(() => panel.start()).toThrow(
				expect.objectContaining({ code: MakooErrorCode.INJECTION_CLOSED })
			);
			expect(panelStatus().lastError).toBe(diagnostic);
			await expect(panel.stop()).rejects.toBe(diagnostic);
			await expect(panel.remove()).rejects.toBe(diagnostic);
			expect(core.command('panel')).toBe(panel);
			expect(element('#host').childElementCount).toBe(0);
			expect(effect).toHaveBeenCalledTimes(1);
		} finally {
			// Vue did not complete the mount, so the test must release its own effects.
			for (const stop of watchers) stop();
		}
	});

	it('controls a standalone listener and leaves it running when the component stops', async () => {
		let received: VueMakooComponent | undefined;
		const Panel = defineComponent({
			setup() {
				const control = useMakooComponent();
				received = control;
				const save = control.globalListener('save');
				return () => h('p', save.status.value);
			}
		});
		core.apply([
			listen({ name: 'save', listenAt: '#save', type: 'click', callback: vi.fn() }),
			inject({
				name: 'panel',
				injectAt: '#host',
				adapter: 'vue',
				component: Panel,
				listeners: [
					listen({ name: 'play', listenAt: '#play', type: 'click', callback: vi.fn() })
				]
			})
		]);
		controls.push(core.command('panel'), core.command('save'));
		await nextTick();
		const save = received?.globalListener('save');
		expect(save?.stop).toBe(core.command('save').stop);
		expect(save?.status).toBe(received?.globalListener('save').status);
		expect(element('#host').textContent).toBe('waiting');
		for (const name of ['panel', 'play', 'missing']) {
			expect(() => received?.globalListener(name)).toThrow(
				expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
			);
		}

		await save?.stop();
		await nextTick();
		expect(save?.status.value).toBe('idle');
		expect(core.statusHandle('save').getSnapshot()).toBe('idle');
		save?.start();
		await flush();
		expect(core.statusHandle('save').getSnapshot()).toBe('waiting');

		await panelCommand().stop();
		expect(core.statusHandle('save').getSnapshot()).toBe('waiting');
	});

	it('keeps one status ref when a standalone listener is replaced', async () => {
		let received: VueMakooComponent | undefined;
		const Panel = defineComponent({
			setup() {
				const control = useMakooComponent();
				received = control;
				const save = control.globalListener('save');
				return () => h('p', save.status.value);
			}
		});
		const declaration = listen({
			name: 'save',
			listenAt: '#save',
			type: 'click',
			callback: vi.fn()
		});
		core.apply([
			declaration,
			inject({ name: 'panel', injectAt: '#host', adapter: 'vue', component: Panel })
		]);
		controls.push(core.command('panel'), core.command('save'));
		await nextTick();
		const status = received?.globalListener('save').status;
		const previous = received?.globalListener('save');
		addButton('save');
		await flush();
		expect(status?.value).toBe('bound');

		await previous?.remove();
		await nextTick();
		expect(status?.value).toBe('idle');
		core.apply([declaration]);
		controls.push(core.command('save'));
		const replacement = received?.globalListener('save');
		expect(replacement?.stop).toBe(core.command('save').stop);
		expect(replacement?.stop).not.toBe(previous?.stop);
		expect(replacement?.status).toBe(status);
		expect(status?.value).toBe('bound');
	});

	it('reports a throwing Vue unmount as cleanup failure', async () => {
		const cause = new Error('unmounted hook failed');
		const Panel = defineComponent({
			setup() {
				return () => h('p', 'panel');
			},
			unmounted() {
				throw cause;
			}
		});
		core.apply([
			inject({ name: 'panel', injectAt: '#host', adapter: 'vue', component: Panel })
		]);
		controls.push(core.command('panel'));
		const panel = panelCommand();

		await expect(panel.stop()).rejects.toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
			errors: [expect.objectContaining({ code: MakooErrorCode.UNMOUNT_FAILED, cause })]
		});
		expect(panelStatus().getSnapshot()).toBe('failed');
		expect(() => panel.start()).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_CLOSED })
		);
	});
});
