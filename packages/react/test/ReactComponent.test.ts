import {
	type ComponentCommand,
	type ComponentStatusHandle,
	createMakoo,
	type InjectionCommand,
	inject,
	type ListenerStatus,
	listen,
	type MakooRuntime,
	type StateView
} from '@makoojs/core';
import { act, createElement, useEffect, useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createReactAdapter,
	type ReactMountAdapter,
	useComponentCommand,
	useComponentStatus,
	useListenerStatus
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
	const controls: InjectionCommand[] = [];
	let core: MakooRuntime;

	function panelCommand(): ComponentCommand {
		return core.command('panel');
	}

	function panelStatus(): ComponentStatusHandle {
		const status = core.status('panel');
		if (!('listener' in status)) throw new Error('Expected a component');
		return status;
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
			controls.push(core.command('panel'));
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
		let received: ComponentCommand | undefined;
		let status: string | undefined;
		function Panel({ title }: { title: string }) {
			received = useComponentCommand();
			status = useComponentStatus();
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
		controls.push(core.command('panel'));

		expect(element('#host').textContent).toBe('hello');
		expect(received?.stop).toBe(core.command('panel').stop);
		expect(status).toBe('mounted');
	});

	it('connects a same-name replacement to its own control and state only', async () => {
		const received: ComponentCommand[] = [];
		function Panel() {
			const control = useComponentCommand();
			const play = useListenerStatus('play');
			received.push(control);
			return createElement('p', null, play);
		}
		addButton('play');
		await applyPanel(Panel);
		const oldCommand = panelCommand();
		const oldView = panelStatus().listener('play');
		await act(async () => oldCommand.remove());

		await applyPanel(Panel);
		const replacement = panelCommand();
		const replacementStatus = panelStatus();
		expect(replacement).not.toBe(oldCommand);
		expect(replacementStatus.listener('play')).not.toBe(oldView);
		expect(received.at(-1)?.stop).toBe(replacement.stop);
		expect(element('#host').textContent).toBe('bound');

		expect(() => oldCommand.start()).toThrow();
		await act(async () => oldCommand.stop());
		expect(replacementStatus.getSnapshot()).toBe('mounted');
		expect(element('#host').textContent).toBe('bound');
	});

	it('renders waiting, binding and local recovery with stable snapshots and no remount', async () => {
		let mounts = 0;
		const seen: ListenerStatus[] = [];
		function Panel() {
			const play = useListenerStatus('play');
			const component = useComponentStatus();
			seen.push(play);
			useEffect(() => {
				mounts += 1;
			}, []);
			return createElement('p', null, `${component}/${play}`);
		}
		await applyPanel(Panel, true);
		const text = () => element('#host').textContent;
		expect(text()).toBe('mounted/waiting');

		await act(async () => addButton('play'));
		expect(text()).toBe('mounted/bound');
		const bound = panelStatus().listener('play').getSnapshot();
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
			const listener = useListenerStatus(selected);
			renders += 1;
			return createElement(
				'button',
				{ type: 'button', className: 'select', onClick: () => select('mute') },
				`${selected}:${listener}`
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
		controls.push(core.command('panel'), core.command('external'));
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
		controls.push(core.command('external'));
		function Panel() {
			const listener = useListenerStatus('external');
			return createElement('p', null, listener);
		}
		await expect(applyPanel(Panel)).rejects.toThrow(/Unknown listener/);
	});

	it('drops the old subscription on unmount and connects the component after reinjection', async () => {
		const renders: string[] = [];
		let subscriptions = 0;
		const counted = new WeakMap<StateView<ListenerStatus>, StateView<ListenerStatus>>();
		function countSubscriptions(view: StateView<ListenerStatus>): StateView<ListenerStatus> {
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
					status: {
						...params.status,
						listener: (name) => countSubscriptions(params.status.listener(name))
					}
				});
			}
		} satisfies ReactMountAdapter);
		function Panel() {
			const control = useComponentCommand();
			const play = useListenerStatus('play');
			renders.push(play);
			return createElement(
				'button',
				{ type: 'button', className: 'close', onClick: () => control.stop() },
				play
			);
		}
		addButton('play');
		await applyPanel(Panel, true);
		const panel = panelCommand();
		const status = panelStatus();
		const view = status.listener('play');
		expect(element('#host .close').textContent).toBe('bound');
		expect(subscriptions).toBe(1);

		await act(async () => element('#host').replaceChildren());
		await vi.waitFor(() => expect(element('#host .close').textContent).toBe('bound'));
		expect(status.listener('play')).toBe(view);
		expect(subscriptions).toBe(1);

		await act(async () => {
			element('#host .close').click();
			await Promise.resolve();
		});
		await vi.waitFor(() => expect(status.getSnapshot()).toBe('idle'));
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
