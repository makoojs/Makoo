import type { MakooContext } from '@makoojs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { VueAdapterError } from '../src/error';
import { createVueAdapter } from '../src/VueAdapter';
import { VuePlugin } from '../src/VuePlugin';

function createMakooApi(): MakooContext {
	return {
		taskId: 'vue-task',
		injectAt: '#vue-adapter',
		enableAlive: vi.fn(),
		disableAlive: vi.fn(),
		reset: vi.fn(),
		destroy: vi.fn(),
		on: vi.fn(() => vi.fn()),
		onTask: vi.fn(() => vi.fn()),
		off: vi.fn(),
		offTask: vi.fn(),
		getLogger: vi.fn(),
		bindListenerSignal: vi.fn(() => false),
		controlListener: vi.fn(() => false)
	};
}

describe('VueAdapter', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
		VuePlugin.clear();
	});

	it('should mount Vue component with makoo root prop', () => {
		const mountPoint = document.createElement('div');
		document.body.appendChild(mountPoint);
		const makoo = createMakooApi();
		let receivedMakoo: MakooContext | undefined;

		const artifact = defineComponent({
			name: 'VueMakooBadge',
			props: {
				makoo: {
					type: Object,
					required: true
				}
			},
			setup(props) {
				receivedMakoo = props.makoo as MakooContext;
				return () => h('div', 'badge');
			}
		});

		const result = createVueAdapter().mount({
			host: mountPoint,
			mountPoint,
			artifact,
			taskId: makoo.taskId,
			injectAt: makoo.injectAt,
			makoo
		});

		expect(result.handle).toBeDefined();
		expect(receivedMakoo).toBe(makoo);
	});

	it('uses injectAt in mount errors and preserves the original cause', () => {
		const mountPoint = document.createElement('div');
		const makoo = { ...createMakooApi(), injectAt: 'body' };
		const cause = new TypeError('plugin install failed');
		VuePlugin.usePlugins({
			install() {
				throw cause;
			}
		});

		let thrown: unknown;
		try {
			createVueAdapter().mount({
				host: mountPoint,
				mountPoint,
				artifact: defineComponent({ render: () => h('div') }),
				taskId: makoo.taskId,
				injectAt: makoo.injectAt,
				makoo
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(VueAdapterError);
		expect((thrown as VueAdapterError).summary).toBe('Failed to mount Vue component at "body"');
		expect((thrown as VueAdapterError).message).not.toContain('[object HTMLDivElement]');
		expect((thrown as VueAdapterError).cause).toBe(cause);
	});
});
