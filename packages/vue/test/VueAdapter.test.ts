import {
	type ComponentCommand,
	type ComponentStatusHandle,
	type ListenerStatus,
	MakooAggregateError,
	MakooErrorCode,
	type StateView
} from '@makoojs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type App, defineComponent, h } from 'vue';
import { useMakooComponent, VueErrorCode } from '../src';
import { createVueAdapter } from '../src/VueAdapter';
import { VuePlugin } from '../src/VuePlugin';

function createCommand(): ComponentCommand {
	return {
		name: 'panel',
		start: vi.fn(),
		stop: vi.fn(async () => {}),
		remove: vi.fn(async () => {})
	};
}

function createStatus(view: StateView<ListenerStatus>): ComponentStatusHandle {
	return {
		getSnapshot: () => 'mounted',
		subscribe: () => () => {},
		lastError: undefined,
		listenerNames: ['play'],
		listener: () => view
	};
}

function createView(unsubscribe: () => void): StateView<ListenerStatus> {
	return {
		getSnapshot: () => 'waiting',
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
		const play = useMakooComponent().listener('play');
		return () => h('div', [play.value, h(FailingChild)]);
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

	it('rethrows a mount failure when cleanup has nothing to report', () => {
		const cause = new TypeError('plugin install failed');
		VuePlugin.usePlugins({
			install() {
				throw cause;
			}
		});

		expect(() =>
			createVueAdapter().mount({
				component: defineComponent({ render: () => h('div') }),
				props: undefined,
				container: document.createElement('div'),
				command: createCommand(),
				status: createStatus(createView(() => {}))
			})
		).toThrow(cause);
	});

	it('releases state subscriptions created before a mount fails', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const unsubscribe = vi.fn();
		const view = createView(unsubscribe);

		expect(() =>
			createVueAdapter().mount({
				component: SubscribingParent,
				props: undefined,
				container: document.createElement('div'),
				command: createCommand(),
				status: createStatus(view)
			})
		).toThrow(
			expect.objectContaining({
				code: MakooErrorCode.MOUNT_CLEANUP_FAILED,
				cause: expect.objectContaining({ message: 'child setup failed' }),
				errors: [
					expect.objectContaining({ code: VueErrorCode.VUE_PARTIAL_MOUNT_UNCONFIRMED })
				]
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
				props: undefined,
				container: document.createElement('div'),
				command: createCommand(),
				status: createStatus(
					createView(() => {
						throw releaseCause;
					})
				)
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(MakooAggregateError);
		if (!(thrown instanceof MakooAggregateError)) throw thrown;
		expect(thrown).toMatchObject({
			code: MakooErrorCode.MOUNT_CLEANUP_FAILED,
			cause: expect.objectContaining({ message: 'child setup failed' })
		});
		expect(thrown.errors).toHaveLength(2);
		expect(thrown.errors).toEqual(
			expect.arrayContaining([
				releaseCause,
				expect.objectContaining({ code: VueErrorCode.VUE_PARTIAL_MOUNT_UNCONFIRMED })
			])
		);
	});

	it('rethrows an unmount failure unchanged', () => {
		const cause = new Error('unmount failed');
		const app = {
			unmount() {
				throw cause;
			}
		} as unknown as App;

		expect(() => createVueAdapter().unmount(app)).toThrow(cause);
	});
});
