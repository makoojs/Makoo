import { describe, expect, it, vi } from 'vitest';
import { inject, listen } from '../src';
import { createActivityStore } from '../src/signal/observeActivitySignal';
import { createVueComponent } from './factory/TaskFactor';

describe('Makoo declarations', () => {
	it('should create component injection declarations without touching the DOM', () => {
		const component = createVueComponent('DeclaredComp');
		const callback = vi.fn();
		const listener = listen('#button', 'click', callback);

		const declaration = inject('#app', component, {
			alive: true,
			scope: 'global',
			timeout: 1200,
			on: listener
		});

		expect(document.body.innerHTML).toBe('');
		expect(declaration).toEqual({
			kind: 'component',
			injectAt: '#app',
			artifact: component,
			options: {
				alive: true,
				scope: 'global',
				timeout: 1200,
				on: listener
			}
		});
	});

	it('should create component injection declarations from object input', () => {
		const component = createVueComponent('DeclaredObjectComp');
		const declaration = inject({
			id: 'declared-object',
			injectAt: '#object-app',
			artifact: component,
			options: {
				alive: true,
				scope: 'global'
			}
		});

		expect(declaration).toEqual({
			kind: 'component',
			id: 'declared-object',
			injectAt: '#object-app',
			artifact: component,
			options: {
				alive: true,
				scope: 'global'
			}
		});
	});

	it('should create listener declarations that can be used standalone or inside inject options', () => {
		const signal = createActivityStore(true);
		const activitySignal = () => signal;
		const callback = vi.fn();

		const declaration = listen('#escape', 'keydown', callback, { activitySignal });

		expect(declaration).toEqual({
			kind: 'listener',
			listenAt: '#escape',
			event: 'keydown',
			type: 'keydown',
			callback,
			activitySignal
		});
	});

	it('should create listener declarations from object input', () => {
		const signal = createActivityStore(true);
		const activitySignal = () => signal;
		const callback = vi.fn();

		const declaration = listen({
			id: 'escape-close',
			listenAt: '#escape',
			type: 'keydown',
			callback,
			activitySignal
		});

		expect(declaration).toEqual({
			kind: 'listener',
			id: 'escape-close',
			listenAt: '#escape',
			event: 'keydown',
			type: 'keydown',
			callback,
			activitySignal
		});
	});
});
