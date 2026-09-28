import {
	type ComponentControl,
	createMakoo,
	ErrorCode,
	type InjectionControl,
	inject,
	listen,
	type MakooRuntime
} from '@makoojs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, type Ref, reactive, watchEffect } from 'vue';
import { createVueAdapter, useMakooComponent, type VueMakooComponent } from '../src';

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
	const controls: InjectionControl[] = [];
	let core: MakooRuntime;

	function panelControl(): ComponentControl {
		const control = core.get('panel');
		if (!('listenerState' in control)) throw new Error('Expected a component');
		return control;
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
		expect(() => useMakooComponent()).toThrow(/Makoo Vue adapter/);
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
		controls.push(core.get('panel'));

		const container = element('#host').firstElementChild;
		expect(container?.textContent).toBe('Count:1');
		expect(received?.stop).toBe(core.get('panel').stop);
		expect(received?.state.value.status).toBe('mounted');
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
				const play = control.listenerState('play');
				const component = control.state;
				return () => h('p', `${component.value.status}/${play.value.status}`);
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
		controls.push(core.get('panel'));
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
						`${control.listenerState('play').value.status}/${control.listenerState('mute').value.status}`
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
		controls.push(core.get('panel'), core.get('external'));
		await nextTick();
		expect(element('#host').textContent).toBe('waiting/waiting');
		addButton('mute');
		await flush();
		expect(element('#host').textContent).toBe('waiting/bound');
		addButton('play');
		await flush();
		expect(element('#host').textContent).toBe('bound/bound');
		expect(received?.listenerState('play')).toBe(received?.listenerState('play'));
		expect(() => received?.listenerState('external')).toThrow(/Unknown listener/);
	});

	it('releases the old instance subscription when the component stops itself and restarts externally', async () => {
		const snapshots: Ref<{ readonly status: string }>[] = [];
		const Panel = defineComponent({
			setup() {
				const control = useMakooComponent();
				const play = control.listenerState('play');
				snapshots.push(play);
				return () =>
					h(
						'button',
						{ class: 'close', onClick: () => control.stop() },
						play.value.status
					);
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
		controls.push(core.get('panel'));
		const panel = panelControl();
		const view = panel.listenerState('play');
		await nextTick();
		expect(element('#host .close').textContent).toBe('bound');

		element('#host .close').click();
		await vi.waitFor(() => expect(panel.state.getSnapshot().status).toBe('idle'));
		expect(element('#host').childElementCount).toBe(0);
		const oldSnapshot = snapshots[0]?.value;

		panel.start();
		await nextTick();
		expect(snapshots).toHaveLength(2);
		expect(panel.listenerState('play')).toBe(view);
		expect(element('#host .close').textContent).toBe('bound');
		expect(snapshots[1]?.value).toBe(view.getSnapshot());

		element('#play').remove();
		await flush();
		expect(snapshots[0]?.value).toBe(oldSnapshot);
		expect(snapshots[1]?.value.status).toBe('failed');
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
			const panel = panelControl();
			controls.push(panel);
			await vi.waitFor(() => expect(panel.state.getSnapshot().status).toBe('failed'));

			expect(panel.lastError).toMatchObject({
				code: ErrorCode.ADAPTER_MOUNT_FAIL,
				cause: { cause },
				cleanupErrors: [expect.objectContaining({ code: ErrorCode.ADAPTER_UNMOUNT_FAIL })]
			});
			expect(() => panel.start()).toThrow(
				expect.objectContaining({ code: ErrorCode.INJECTION_CLEANUP_FAILED })
			);
			await expect(panel.stop()).rejects.toMatchObject({
				code: ErrorCode.ADAPTER_UNMOUNT_FAIL
			});
			await expect(panel.remove()).rejects.toMatchObject({
				code: ErrorCode.ADAPTER_UNMOUNT_FAIL
			});
			expect(core.get('panel')).toBe(panel);
			expect(element('#host').childElementCount).toBe(0);
			expect(effect).toHaveBeenCalledTimes(1);
		} finally {
			// Vue did not complete the mount, so the test must release its own effects.
			for (const stop of watchers) stop();
		}
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
		controls.push(core.get('panel'));
		const panel = panelControl();

		await expect(panel.stop()).rejects.toMatchObject({ code: ErrorCode.ADAPTER_UNMOUNT_FAIL });
		expect(panel.state.getSnapshot().status).toBe('failed');
		expect(() => panel.start()).toThrow(
			expect.objectContaining({ code: ErrorCode.INJECTION_CLEANUP_FAILED })
		);
	});
});
