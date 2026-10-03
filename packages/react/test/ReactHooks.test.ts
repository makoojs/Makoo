import type {
	ComponentCommand,
	ComponentStatus,
	ComponentStatusHandle,
	ListenerStatus,
	StateView
} from '@makoojs/core';
import { MakooError } from '@makoojs/core';
import {
	act,
	type ComponentType,
	createElement,
	StrictMode,
	Suspense,
	startTransition,
	useLayoutEffect,
	useState
} from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createReactAdapter,
	type ReactMountRoot,
	useComponentCommand,
	useComponentStatus,
	useComponentStatusHandle,
	useListenerStatus
} from '../src';

function stateSource<T>(initial: Readonly<T>) {
	let snapshot = initial;
	const subscribers = new Set<() => void>();
	const view: StateView<T> = {
		getSnapshot: () => snapshot,
		subscribe(notify) {
			subscribers.add(notify);
			return () => {
				subscribers.delete(notify);
			};
		}
	};
	return {
		view,
		get subscriptions() {
			return subscribers.size;
		},
		publish(next: Readonly<T>) {
			snapshot = next;
			for (const notify of subscribers) notify();
		}
	};
}

describe('React hook subscriptions at the adapter boundary', () => {
	const adapter = createReactAdapter();
	const roots: ReactMountRoot[] = [];
	let componentState: ReturnType<typeof stateSource<ComponentStatus>>;
	let playState: ReturnType<typeof stateSource<ListenerStatus>>;
	let muteState: ReturnType<typeof stateSource<ListenerStatus>>;
	let command: ComponentCommand;
	let status: ComponentStatusHandle;
	let container: HTMLDivElement;

	async function mount(component: ComponentType) {
		await act(async () => {
			roots.push(
				adapter.mount({
					component: () => createElement(StrictMode, null, createElement(component)),
					props: undefined,
					container,
					command,
					status
				})
			);
		});
	}

	beforeAll(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
	});
	afterAll(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = false;
	});
	beforeEach(() => {
		container = document.createElement('div');
		document.body.append(container);
		componentState = stateSource<ComponentStatus>('mounted');
		playState = stateSource<ListenerStatus>('waiting');
		muteState = stateSource<ListenerStatus>('waiting');
		command = {
			name: 'panel',
			start: vi.fn(),
			stop: vi.fn(async () => {}),
			remove: vi.fn(async () => {})
		};
		status = {
			getSnapshot: componentState.view.getSnapshot,
			subscribe: componentState.view.subscribe,
			lastError: undefined,
			listenerNames: ['play', 'mute'],
			listener(name) {
				if (name === 'play') return playState.view;
				if (name === 'mute') return muteState.view;
				throw new Error(`Unknown listener: ${name}`);
			}
		};
	});
	afterEach(async () => {
		await act(async () => {
			for (const root of roots.splice(0)) adapter.unmount(root);
		});
		expect(componentState.subscriptions).toBe(0);
		expect(playState.subscriptions).toBe(0);
		expect(muteState.subscriptions).toBe(0);
		container.remove();
	});

	it('keeps controls stable across local renders without subscribing to any state', async () => {
		const received: ComponentCommand[] = [];
		function Panel() {
			const actions = useComponentCommand();
			const [count, setCount] = useState(0);
			received.push(actions);
			return createElement(
				'button',
				{ type: 'button', onClick: () => setCount(count + 1) },
				count
			);
		}
		await mount(Panel);
		expect(componentState.subscriptions).toBe(0);
		expect(playState.subscriptions).toBe(0);
		expect(muteState.subscriptions).toBe(0);
		const initialRenders = received.length;
		await act(async () => {
			componentState.publish('waiting');
			playState.publish('bound');
		});
		expect(received).toHaveLength(initialRenders);
		await act(async () => container.querySelector('button')?.click());
		expect(container.textContent).toBe('1');
		expect(received.at(-1)).toBe(received[0]);
		expect(received[0]).toMatchObject({
			name: 'panel',
			start: command.start,
			stop: command.stop,
			remove: command.remove
		});
		expect(received[0]).not.toHaveProperty('status');
		expect(received[0]).not.toHaveProperty('listener');
	});

	it('exposes a stable status handle whose lastError reads do not subscribe', async () => {
		let lastError: MakooError | undefined;
		status = {
			...status,
			get lastError() {
				return lastError;
			}
		};
		const received: ComponentStatusHandle[] = [];
		const readErrors: Array<MakooError | undefined> = [];
		function Panel() {
			const handle = useComponentStatusHandle();
			const [count, setCount] = useState(0);
			received.push(handle);
			readErrors.push(handle.lastError);
			return createElement(
				'button',
				{ type: 'button', onClick: () => setCount(count + 1) },
				count
			);
		}
		await mount(Panel);
		expect(componentState.subscriptions).toBe(0);
		const initialRenders = received.length;
		lastError = new MakooError('mount failed');
		await act(async () => componentState.publish('failed'));
		expect(received).toHaveLength(initialRenders);
		await act(async () => container.querySelector('button')?.click());
		expect(received.at(-1)).toBe(received[0]);
		expect(received[0]).toBe(status);
		expect(readErrors.at(-1)).toBe(lastError);
		expect(componentState.subscriptions).toBe(0);
	});

	it('isolates component state and attached listeners in sibling consumers', async () => {
		const renders = { component: 0, play: 0, mute: 0 };
		function Status() {
			const componentStatus = useComponentStatus();
			renders.component += 1;
			return createElement('p', { id: 'component-status' }, componentStatus);
		}
		function Play() {
			const listenerStatus = useListenerStatus('play');
			renders.play += 1;
			return createElement('p', { id: 'play-status' }, listenerStatus);
		}
		function Mute() {
			const listenerStatus = useListenerStatus('mute');
			renders.mute += 1;
			return createElement('p', { id: 'mute-status' }, listenerStatus);
		}
		await mount(() =>
			createElement(
				'div',
				null,
				createElement(Status),
				createElement(Play),
				createElement(Mute)
			)
		);
		const initialRenders = { ...renders };
		await act(async () => muteState.publish('bound'));
		expect(renders.component).toBe(initialRenders.component);
		expect(renders.play).toBe(initialRenders.play);
		expect(renders.mute).toBeGreaterThan(initialRenders.mute);
		expect(container.querySelector('#mute-status')?.textContent).toBe('bound');
		const muteRenders = renders.mute;
		await act(async () => componentState.publish('waiting'));
		expect(renders.component).toBeGreaterThan(initialRenders.component);
		expect(renders.play).toBe(initialRenders.play);
		expect(renders.mute).toBe(muteRenders);
	});

	it('releases the previous listener when the name changes', async () => {
		function Panel() {
			const [name, setName] = useState('play');
			const listenerStatus = useListenerStatus(name);
			return createElement(
				'button',
				{ type: 'button', onClick: () => setName('mute') },
				`${name}:${listenerStatus}`
			);
		}
		await mount(Panel);
		expect(playState.subscriptions).toBe(1);
		expect(muteState.subscriptions).toBe(0);
		await act(async () => muteState.publish('bound'));
		await act(async () => container.querySelector('button')?.click());
		expect(container.textContent).toBe('mute:bound');
		expect(playState.subscriptions).toBe(0);
		expect(muteState.subscriptions).toBe(1);
		await act(async () => muteState.publish('waiting'));
		expect(container.textContent).toBe('mute:waiting');
	});

	it('renders a listener selection only when its result changes', async () => {
		let renders = 0;
		function Panel() {
			const ready = useListenerStatus('play', (listenerStatus) => listenerStatus === 'bound');
			renders += 1;
			return createElement('p', null, String(ready));
		}
		await mount(Panel);
		expect(container.textContent).toBe('false');
		const initialRenders = renders;
		await act(async () => playState.publish('idle'));
		expect(renders).toBe(initialRenders);
		await act(async () => playState.publish('bound'));
		expect(container.textContent).toBe('true');
		expect(renders).toBeGreaterThan(initialRenders);
		const boundRenders = renders;
		await act(async () => playState.publish('bound'));
		expect(renders).toBe(boundRenders);
	});

	it('renders a component selection only when its result changes', async () => {
		let renders = 0;
		function Panel() {
			const failed = useComponentStatus((componentStatus) => componentStatus === 'failed');
			renders += 1;
			return createElement('p', null, String(failed));
		}
		await mount(Panel);
		expect(container.textContent).toBe('false');
		const initialRenders = renders;
		await act(async () => componentState.publish('waiting'));
		expect(renders).toBe(initialRenders);
		await act(async () => componentState.publish('failed'));
		expect(container.textContent).toBe('true');
		expect(renders).toBeGreaterThan(initialRenders);
	});

	it('uses the latest selector after a local render without resubscribing', async () => {
		const subscribe = vi.spyOn(playState.view, 'subscribe');
		function Panel() {
			const [expected, setExpected] = useState('bound');
			const matches = useListenerStatus(
				'play',
				(listenerStatus) => listenerStatus === expected
			);
			return createElement(
				'button',
				{ type: 'button', onClick: () => setExpected('waiting') },
				String(matches)
			);
		}
		await mount(Panel);
		expect(container.textContent).toBe('false');
		const subscriptionCalls = subscribe.mock.calls.length;
		await act(async () => container.querySelector('button')?.click());
		expect(container.textContent).toBe('true');
		await act(async () => playState.publish('bound'));
		expect(container.textContent).toBe('false');
		expect(subscribe).toHaveBeenCalledTimes(subscriptionCalls);
	});

	it('caches object selection results for repeated reads of the same snapshot', async () => {
		let renders = 0;
		function Panel() {
			const selected = useListenerStatus('play', (listenerStatus) => ({
				ready: listenerStatus === 'bound'
			}));
			renders += 1;
			return createElement('p', null, String(selected.ready));
		}
		await mount(Panel);
		expect(container.textContent).toBe('false');
		await act(async () => playState.publish('bound'));
		expect(container.textContent).toBe('true');
		const boundRenders = renders;
		await act(async () => playState.publish('bound'));
		expect(renders).toBe(boundRenders);
	});

	it('catches a state change between rendering and subscription', async () => {
		function Panel() {
			const listenerStatus = useListenerStatus('play');
			useLayoutEffect(() => {
				playState.publish('bound');
			}, []);
			return createElement('p', null, listenerStatus);
		}
		await mount(Panel);
		expect(container.textContent).toBe('bound');
		expect(playState.subscriptions).toBe(1);
	});

	it('does not subscribe a suspended render and uses the latest snapshot when it commits', async () => {
		let resume!: () => void;
		let pending = true;
		const ready = new Promise<void>((resolve) => {
			resume = resolve;
		});
		function Panel() {
			const listenerStatus = useListenerStatus('play');
			if (pending) throw ready;
			return createElement('p', null, listenerStatus);
		}
		await mount(() => createElement(Suspense, { fallback: 'loading' }, createElement(Panel)));
		expect(container.textContent).toBe('loading');
		expect(playState.subscriptions).toBe(0);
		await act(async () => {
			playState.publish('bound');
			pending = false;
			resume();
			await ready;
		});
		expect(container.textContent).toBe('bound');
		expect(playState.subscriptions).toBe(1);
	});

	it('keeps the committed selector active while a different selector render is suspended', async () => {
		let resume!: () => void;
		let pending = true;
		const ready = new Promise<void>((resolve) => {
			resume = resolve;
		});
		playState.publish('bound');
		function Panel({ expected }: { expected: string }) {
			const matches = useListenerStatus(
				'play',
				(listenerStatus) => listenerStatus === expected
			);
			if (expected === 'waiting' && pending) throw ready;
			return createElement('p', null, `${expected}:${matches}`);
		}
		function App() {
			const [expected, setExpected] = useState('bound');
			return createElement(
				'div',
				null,
				createElement(
					'button',
					{
						type: 'button',
						onClick: () => startTransition(() => setExpected('waiting'))
					},
					'switch'
				),
				createElement(Suspense, { fallback: 'loading' }, createElement(Panel, { expected }))
			);
		}
		await mount(App);
		await act(async () => container.querySelector('button')?.click());
		expect(container.querySelector('p')?.textContent).toBe('bound:true');
		await act(async () => playState.publish('waiting'));
		expect(container.querySelector('p')?.textContent).toBe('bound:false');
		expect(playState.subscriptions).toBe(1);
		await act(async () => {
			pending = false;
			resume();
			await ready;
		});
		expect(container.querySelector('p')?.textContent).toBe('waiting:true');
		expect(playState.subscriptions).toBe(1);
	});

	it.each([
		['useComponentCommand', () => useComponentCommand()],
		['useComponentStatus', () => useComponentStatus()],
		['useComponentStatusHandle', () => useComponentStatusHandle()],
		['useListenerStatus', () => useListenerStatus('play')]
	] as const)('rejects %s outside an adapter-mounted component', async (_name, useHook) => {
		function Panel() {
			useHook();
			return null;
		}
		const root = createRoot(container);
		roots.push(root);
		await expect(act(async () => root.render(createElement(Panel)))).rejects.toThrow(
			/mounted by the Makoo React adapter/
		);
	});
});
