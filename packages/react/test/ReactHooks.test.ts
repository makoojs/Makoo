import type {
	ComponentControl,
	ComponentSnapshot,
	ListenerSnapshot,
	StateView
} from '@makoojs/core';
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
	type ReactComponentControl,
	type ReactMountRoot,
	useComponentControl,
	useComponentState,
	useListenerState
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
	let componentState: ReturnType<typeof stateSource<ComponentSnapshot>>;
	let playState: ReturnType<typeof stateSource<ListenerSnapshot>>;
	let muteState: ReturnType<typeof stateSource<ListenerSnapshot>>;
	let control: ComponentControl;
	let container: HTMLDivElement;

	async function mount(component: ComponentType) {
		await act(async () => {
			roots.push(
				adapter.mount({
					component: () => createElement(StrictMode, null, createElement(component)),
					props: undefined,
					container,
					control,
					listenerNames: ['play', 'mute']
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
		componentState = stateSource<ComponentSnapshot>({ status: 'mounted' });
		playState = stateSource<ListenerSnapshot>({ status: 'waiting' });
		muteState = stateSource<ListenerSnapshot>({ status: 'waiting' });
		control = {
			name: 'panel',
			lastError: undefined,
			state: componentState.view,
			start: vi.fn(),
			stop: vi.fn(async () => {}),
			remove: vi.fn(async () => {}),
			listenerState(name) {
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
		const received: ReactComponentControl[] = [];
		function Panel() {
			const actions = useComponentControl();
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
			componentState.publish({ status: 'waiting' });
			playState.publish({ status: 'bound' });
		});
		expect(received).toHaveLength(initialRenders);
		await act(async () => container.querySelector('button')?.click());
		expect(container.textContent).toBe('1');
		expect(received.at(-1)).toBe(received[0]);
		expect(received[0]).toMatchObject({
			name: 'panel',
			start: control.start,
			stop: control.stop,
			remove: control.remove
		});
		expect(received[0]).not.toHaveProperty('state');
		expect(received[0]).not.toHaveProperty('listenerState');
	});

	it('isolates component state and attached listeners in sibling consumers', async () => {
		const renders = { component: 0, play: 0, mute: 0 };
		function Status() {
			const state = useComponentState();
			renders.component += 1;
			return createElement('p', { id: 'component-status' }, state.status);
		}
		function Play() {
			const state = useListenerState('play');
			renders.play += 1;
			return createElement('p', { id: 'play-status' }, state.status);
		}
		function Mute() {
			const state = useListenerState('mute');
			renders.mute += 1;
			return createElement('p', { id: 'mute-status' }, state.status);
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
		await act(async () => muteState.publish({ status: 'bound' }));
		expect(renders.component).toBe(initialRenders.component);
		expect(renders.play).toBe(initialRenders.play);
		expect(renders.mute).toBeGreaterThan(initialRenders.mute);
		expect(container.querySelector('#mute-status')?.textContent).toBe('bound');
		const muteRenders = renders.mute;
		await act(async () => componentState.publish({ status: 'waiting' }));
		expect(renders.component).toBeGreaterThan(initialRenders.component);
		expect(renders.play).toBe(initialRenders.play);
		expect(renders.mute).toBe(muteRenders);
	});

	it('releases the previous listener when the name changes', async () => {
		function Panel() {
			const [name, setName] = useState('play');
			const state = useListenerState(name);
			return createElement(
				'button',
				{ type: 'button', onClick: () => setName('mute') },
				`${name}:${state.status}`
			);
		}
		await mount(Panel);
		expect(playState.subscriptions).toBe(1);
		expect(muteState.subscriptions).toBe(0);
		await act(async () => muteState.publish({ status: 'bound' }));
		await act(async () => container.querySelector('button')?.click());
		expect(container.textContent).toBe('mute:bound');
		expect(playState.subscriptions).toBe(0);
		expect(muteState.subscriptions).toBe(1);
		await act(async () => muteState.publish({ status: 'waiting' }));
		expect(container.textContent).toBe('mute:waiting');
	});

	it('renders a listener selection only when its result changes', async () => {
		let renders = 0;
		function Panel() {
			const ready = useListenerState('play', (state) => state.status === 'bound');
			renders += 1;
			return createElement('p', null, String(ready));
		}
		await mount(Panel);
		expect(container.textContent).toBe('false');
		const initialRenders = renders;
		await act(async () => playState.publish({ status: 'idle' }));
		expect(renders).toBe(initialRenders);
		await act(async () => playState.publish({ status: 'bound' }));
		expect(container.textContent).toBe('true');
		expect(renders).toBeGreaterThan(initialRenders);
		const boundRenders = renders;
		await act(async () => playState.publish({ status: 'bound' }));
		expect(renders).toBe(boundRenders);
	});

	it('renders a component selection only when its result changes', async () => {
		let renders = 0;
		function Panel() {
			const failed = useComponentState((state) => state.status === 'failed');
			renders += 1;
			return createElement('p', null, String(failed));
		}
		await mount(Panel);
		expect(container.textContent).toBe('false');
		const initialRenders = renders;
		await act(async () => componentState.publish({ status: 'waiting' }));
		expect(renders).toBe(initialRenders);
		await act(async () => componentState.publish({ status: 'failed' }));
		expect(container.textContent).toBe('true');
		expect(renders).toBeGreaterThan(initialRenders);
	});

	it('uses the latest selector after a local render without resubscribing', async () => {
		const subscribe = vi.spyOn(playState.view, 'subscribe');
		function Panel() {
			const [expected, setExpected] = useState('bound');
			const matches = useListenerState('play', (state) => state.status === expected);
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
		await act(async () => playState.publish({ status: 'bound' }));
		expect(container.textContent).toBe('false');
		expect(subscribe).toHaveBeenCalledTimes(subscriptionCalls);
	});

	it('caches object selection results for repeated reads of the same snapshot', async () => {
		function Panel() {
			const selected = useListenerState('play', (state) => ({
				ready: state.status === 'bound'
			}));
			return createElement('p', null, String(selected.ready));
		}
		await mount(Panel);
		expect(container.textContent).toBe('false');
		await act(async () => playState.publish({ status: 'bound' }));
		expect(container.textContent).toBe('true');
	});

	it('catches a state change between rendering and subscription', async () => {
		function Panel() {
			const status = useListenerState('play', (state) => state.status);
			useLayoutEffect(() => {
				playState.publish({ status: 'bound' });
			}, []);
			return createElement('p', null, status);
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
			const status = useListenerState('play', (state) => state.status);
			if (pending) throw ready;
			return createElement('p', null, status);
		}
		await mount(() => createElement(Suspense, { fallback: 'loading' }, createElement(Panel)));
		expect(container.textContent).toBe('loading');
		expect(playState.subscriptions).toBe(0);
		await act(async () => {
			playState.publish({ status: 'bound' });
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
		playState.publish({ status: 'bound' });
		function Panel({ expected }: { expected: string }) {
			const matches = useListenerState('play', (state) => state.status === expected);
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
		await act(async () => playState.publish({ status: 'waiting' }));
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
		['useComponentControl', () => useComponentControl()],
		['useComponentState', () => useComponentState()],
		['useListenerState', () => useListenerState('play')]
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
