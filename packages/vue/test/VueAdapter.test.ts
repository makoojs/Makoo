import type { MakooContext } from '@makoojs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createVueAdapter } from '../src/VueAdapter';

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
});
