import { describe, expect, it, vi } from 'vitest';
import { inject, listen } from '../src';

describe('Makoo declarations', () => {
	it('should create an injection declaration without touching the DOM', () => {
		const component = { name: 'Panel' };
		const props = { title: 'Hello' };
		vi.stubGlobal('document', undefined);
		const declaration = inject({
			name: 'panel',
			injectAt: '#app',
			adapter: 'vue',
			component,
			props,
			timeout: 1200
		});
		vi.unstubAllGlobals();

		expect(document.body.innerHTML).toBe('');
		expect(Object.isFrozen(props)).toBe(false);
		expect(declaration).toEqual({
			kind: 'injection',
			name: 'panel',
			injectAt: '#app',
			adapter: 'vue',
			component,
			props,
			timeout: 1200
		});
	});

	it('should keep the declared component and props references', () => {
		const component = { name: 'Panel' };
		const props = { title: 'Hello' };
		const declaration = inject({
			name: 'panel',
			injectAt: '#app',
			adapter: 'vue',
			component,
			props
		});

		expect(declaration.component).toBe(component);
		expect(declaration.props).toBe(props);
	});

	it('should create a named host listener declaration', () => {
		const callback = vi.fn();

		const declaration = listen({
			name: 'escape',
			listenAt: '#escape',
			type: 'keydown',
			callback,
			capture: true
		});

		expect(declaration).toEqual({
			kind: 'listener',
			name: 'escape',
			listenAt: '#escape',
			type: 'keydown',
			callback,
			capture: true
		});
	});

	it('should preserve an explicit false capture option', () => {
		const callback = vi.fn();
		const declaration = listen({
			name: 'escape',
			listenAt: '#escape',
			type: 'keydown',
			callback,
			capture: false
		});

		expect(declaration).toMatchObject({
			callback,
			capture: false
		});
	});

	it('should preserve an explicit listener name', () => {
		const callback = vi.fn();

		const declaration = listen({
			name: 'escape-close',
			listenAt: '#escape',
			type: 'keydown',
			callback
		});

		expect(declaration).toEqual({
			kind: 'listener',
			name: 'escape-close',
			listenAt: '#escape',
			type: 'keydown',
			callback
		});
	});
});
