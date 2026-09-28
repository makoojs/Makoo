import {
	type ComponentControl,
	ErrorCode,
	type ListenerSnapshot,
	type MakooError,
	type StateView
} from '@makoojs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type App, defineComponent, h } from 'vue';
import { useMakooComponent } from '../src';
import { VueAdapterError } from '../src/error';
import { createVueAdapter } from '../src/VueAdapter';
import { VuePlugin } from '../src/VuePlugin';

function createControl(view: StateView<ListenerSnapshot>): ComponentControl {
	return {
		name: 'panel',
		state: { getSnapshot: () => ({ status: 'mounted' }), subscribe: () => () => {} },
		lastError: undefined,
		listenerState: () => view,
		start: vi.fn(),
		stop: vi.fn(async () => {}),
		remove: vi.fn(async () => {})
	};
}

function createView(unsubscribe: () => void): StateView<ListenerSnapshot> {
	return {
		getSnapshot: () => ({ status: 'waiting' }),
		subscribe: vi.fn(() => unsubscribe)
	};
}

const FailingChild = defineComponent({
	setup() {
		throw new Error('child setup failed');
	}
});

const SubscribingParent = defineComponent({
	setup() {
		const play = useMakooComponent().listenerState('play');
		return () => h('div', [play.value.status, h(FailingChild)]);
	}
});

describe('VueAdapter', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
		VuePlugin.clear();
	});

	it('is registered under the explicit name "vue"', () => {
		expect(createVueAdapter().name).toBe('vue');
	});

	it('wraps mount failures and preserves the original cause', () => {
		const cause = new TypeError('plugin install failed');
		VuePlugin.usePlugins({
			install() {
				throw cause;
			}
		});

		let thrown: unknown;
		try {
			createVueAdapter().mount({
				component: defineComponent({ render: () => h('div') }),
				listenerNames: [],
				props: undefined,
				container: document.createElement('div'),
				control: createControl(createView(() => {}))
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(VueAdapterError);
		expect(thrown).toMatchObject({
			code: ErrorCode.ADAPTER_MOUNT_FAIL,
			cause,
			cleanupErrors: []
		});
	});

	it('releases state subscriptions created before a mount fails', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const unsubscribe = vi.fn();
		const view = createView(unsubscribe);

		expect(() =>
			createVueAdapter().mount({
				component: SubscribingParent,
				listenerNames: ['play'],
				props: undefined,
				container: document.createElement('div'),
				control: createControl(view)
			})
		).toThrow(
			expect.objectContaining({
				code: ErrorCode.ADAPTER_MOUNT_FAIL,
				cleanupErrors: [expect.objectContaining({ code: ErrorCode.ADAPTER_UNMOUNT_FAIL })]
			})
		);
		expect(view.subscribe).toHaveBeenCalledOnce();
		expect(unsubscribe).toHaveBeenCalledOnce();
	});

	it('reports subscription release failures after a failed mount', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const releaseCause = new Error('release failed');

		let thrown: unknown;
		try {
			createVueAdapter().mount({
				component: SubscribingParent,
				listenerNames: ['play'],
				props: undefined,
				container: document.createElement('div'),
				control: createControl(
					createView(() => {
						throw releaseCause;
					})
				)
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(VueAdapterError);
		const { cleanupErrors } = thrown as MakooError;
		expect(cleanupErrors).toHaveLength(2);
		expect(cleanupErrors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: ErrorCode.ADAPTER_UNMOUNT_FAIL,
					cause: releaseCause
				}),
				expect.objectContaining({
					code: ErrorCode.ADAPTER_UNMOUNT_FAIL,
					cause: expect.objectContaining({ message: 'child setup failed' })
				})
			])
		);
	});

	it('wraps unmount failures with the original cause', () => {
		const cause = new Error('unmount failed');
		const app = {
			unmount() {
				throw cause;
			}
		} as unknown as App;

		expect(() => createVueAdapter().unmount(app)).toThrow(
			expect.objectContaining({
				name: 'VueAdapterError',
				code: ErrorCode.ADAPTER_UNMOUNT_FAIL,
				cause
			})
		);
	});
});
