import {
	type ComponentControl,
	type ComponentSnapshot,
	createMakoo,
	type InjectionControl,
	inject,
	type ListenerSnapshot,
	listen,
	type MakooRuntime,
	type StateView
} from '@makoojs/core';
import { act, createElement, useEffect, useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createReactAdapter,
	type ReactComponentControl,
	type ReactMountAdapter,
	useComponentControl,
	useComponentState,
	useListenerState
} from '../src';

type ActEnvironment = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

function element(selector: string): HTMLElement {
	const target = document.querySelector<HTMLElement>(selector);
	if (!target) throw new Error(`Missing test element: ${selector}`);
	return target;
}

function addButton(id: string): void {
	const button = document.createElement('button');
	button.id = id;
	document.body.append(button);
}

const playListener = () =>
	listen({ name: 'play', listenAt: '#play', type: 'click', callback: vi.fn() });

describe('React components mounted by core', () => {
	const controls: InjectionControl[] = [];
	let core: MakooRuntime;

	function panelControl(): ComponentControl {
		const control = core.get('panel');
		if (!('listenerState' in control)) throw new Error('Expected a component');
		return control;
	}

	async function applyPanel(component: () => unknown, reinject = false): Promise<void> {
		await act(async () => {
			core.apply([
				inject({
					name: 'panel',
					injectAt: '#host',
					adapter: 'react',
					component,
					reinject,
					listeners: [playListener()]
				})
			]);
			controls.push(core.get('panel'));
		});
	}

	beforeAll(() => {
		(globalThis as ActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
	});

	afterAll(() => {
		(globalThis as ActEnvironment).IS_REACT_ACT_ENVIRONMENT = false;
	});

	beforeEach(() => {
		document.body.innerHTML = '<section id="host"></section>';
		core = createMakoo();
		core.useAdapter(createReactAdapter());
	});

	afterEach(async () => {
		await act(async () => {
			for (const control of controls.splice(0)) await control.remove().catch(() => {});
		});
		vi.restoreAllMocks();
		document.body.replaceChildren();
	});

	it('passes props and the owning control to a real component', async () => {
		let received: ReactComponentControl | undefined;
		let state: Readonly<ComponentSnapshot> | undefined;
		function Panel({ title }: { title: string }) {
			received = useComponentControl();
			state = useComponentState();
			return createElement('p', null, title);
		}
		await act(async () => {
			core.apply([
				inject({
					name: 'panel',
					injectAt: '#host',
					adapter: 'react',
					component: Panel,
					props: { title: 'hello' }
				})
			]);
		});
		controls.push(core.get('panel'));

		expect(element('#host').textContent).toBe('hello');
		expect(received?.stop).toBe(core.get('panel').stop);
		expect(state?.status).toBe('mounted');
	});

	it('connects a same-name replacement to its own control and state only', async () => {
		const received: ReactComponentControl[] = [];
		function Panel() {
			const control = useComponentControl();
			const play = useListenerState('play');
			received.push(control);
			return createElement('p', null, play.status);
		}
		addButton('play');
		await applyPanel(Panel);
		const oldControl = panelControl();
		const oldView = oldControl.listenerState('play');
		await act(async () => oldControl.remove());

		await applyPanel(Panel);
		const replacement = panelControl();
		expect(replacement).not.toBe(oldControl);
		expect(replacement.listenerState('play')).not.toBe(oldView);
		expect(received.at(-1)?.stop).toBe(replacement.stop);
		expect(element('#host').textContent).toBe('bound');

		expect(() => oldControl.start()).toThrow();
		await act(async () => oldControl.stop());
		expect(replacement.state.getSnapshot().status).toBe('mounted');
		expect(element('#host').textContent).toBe('bound');
	});

	it('renders waiting, binding and local recovery with stable snapshots and no remount', async () => {
		let mounts = 0;
		const seen: ListenerSnapshot[] = [];
		function Panel() {
			const play = useListenerState('play');
			const component = useComponentState();
			seen.push(play);
			useEffect(() => {
				mounts += 1;
			}, []);
			return createElement('p', null, `${component.status}/${play.status}`);
		}
		await applyPanel(Panel, true);
		const text = () => element('#host').textContent;
		expect(text()).toBe('mounted/waiting');

		await act(async () => addButton('play'));
		expect(text()).toBe('mounted/bound');
		const bound = panelControl().listenerState('play').getSnapshot();
		expect(seen.at(-1)).toBe(bound);

		await act(async () => element('#play').remove());
		expect(text()).toBe('mounted/waiting');

		await act(async () => addButton('play'));
		expect(text()).toBe('mounted/bound');
		expect(mounts).toBe(1);
	});

	it('updates only for the selected listener and switches names between renders', async () => {
		let renders = 0;
		function Panel() {
			const [selected, select] = useState('play');
			const listener = useListenerState(selected);
			renders += 1;
			return createElement(
				'button',
				{ type: 'button', className: 'select', onClick: () => select('mute') },
				`${selected}:${listener.status}`
			);
		}
		await act(async () => {
			core.apply([
				listen({ name: 'external', listenAt: '#host', type: 'click', callback: vi.fn() }),
				inject({
					name: 'panel',
					injectAt: '#host',
					adapter: 'react',
					component: Panel,
					listeners: ['play', 'mute'].map((name) =>
						listen({ name, listenAt: `#${name}`, type: 'click', callback: vi.fn() })
					)
				})
			]);
		});
		controls.push(core.get('panel'), core.get('external'));
		expect(element('#host').textContent).toBe('play:waiting');
		const playRenders = renders;
		await act(async () => addButton('mute'));
		expect(renders).toBe(playRenders);
		await act(async () => element('#host .select').click());
		expect(element('#host').textContent).toBe('mute:bound');
		const muteRenders = renders;
		await act(async () => addButton('play'));
		expect(renders).toBe(muteRenders);
	});

	it('does not resolve a global listener through the attached listener hook', async () => {
		core.apply([
			listen({ name: 'external', listenAt: '#host', type: 'click', callback: vi.fn() })
		]);
		controls.push(core.get('external'));
		function Panel() {
			const listener = useListenerState('external');
			return createElement('p', null, listener.status);
		}
		await expect(applyPanel(Panel)).rejects.toThrow(/Unknown listener/);
	});

	it('drops the old subscription on unmount and connects the component after reinjection', async () => {
		const renders: string[] = [];
		let subscriptions = 0;
		const counted = new WeakMap<StateView<ListenerSnapshot>, StateView<ListenerSnapshot>>();
		function countSubscriptions(
			view: StateView<ListenerSnapshot>
		): StateView<ListenerSnapshot> {
			let wrapped = counted.get(view);
			if (!wrapped) {
				wrapped = {
					getSnapshot: view.getSnapshot,
					subscribe(notify) {
						subscriptions += 1;
						const unsubscribe = view.subscribe(notify);
						return () => {
							subscriptions -= 1;
							unsubscribe();
						};
					}
				};
				counted.set(view, wrapped);
			}
			return wrapped;
		}
		core = createMakoo();
		const adapter = createReactAdapter();
		core.useAdapter({
			...adapter,
			mount(params) {
				return adapter.mount({
					...params,
					control: {
						...params.control,
						listenerState: (name) =>
							countSubscriptions(params.control.listenerState(name))
					}
				});
			}
		} satisfies ReactMountAdapter);
		function Panel() {
			const control = useComponentControl();
			const play = useListenerState('play');
			renders.push(play.status);
			return createElement(
				'button',
				{ type: 'button', className: 'close', onClick: () => control.stop() },
				play.status
			);
		}
		addButton('play');
		await applyPanel(Panel, true);
		const panel = panelControl();
		const view = panel.listenerState('play');
		expect(element('#host .close').textContent).toBe('bound');
		expect(subscriptions).toBe(1);

		await act(async () => element('#host').replaceChildren());
		await vi.waitFor(() => expect(element('#host .close').textContent).toBe('bound'));
		expect(panel.listenerState('play')).toBe(view);
		expect(subscriptions).toBe(1);

		await act(async () => {
			element('#host .close').click();
			await Promise.resolve();
		});
		await vi.waitFor(() => expect(panel.state.getSnapshot().status).toBe('idle'));
		expect(element('#host').childElementCount).toBe(0);
		expect(subscriptions).toBe(0);
		const rendersAfterStop = renders.length;

		await act(async () => {
			element('#play').remove();
			addButton('play');
		});
		expect(renders).toHaveLength(rendersAfterStop);

		await act(async () => panel.start());
		expect(element('#host .close').textContent).toBe('bound');
		expect(subscriptions).toBe(1);
	});
});
