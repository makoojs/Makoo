import {
	type ComponentStatusHandle,
	createMakoo,
	inject,
	type ListenerStatusHandle,
	listen,
	MakooErrorCode
} from '@makoojs/core';
import { createReactAdapter, useComponentStatus, useListenerStatus } from '@makoojs/react';
import { act, createElement } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { createVueAdapter, useMakooComponent } from '../src';

type ActEnvironment = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

function element(selector: string): HTMLElement {
	const target = document.querySelector<HTMLElement>(selector);
	if (!target) throw new Error(`Missing test element: ${selector}`);
	return target;
}

function componentStatus(
	core: ReturnType<typeof createMakoo>,
	name: string
): ComponentStatusHandle {
	const status = core.status(name);
	if (!('listener' in status)) throw new Error(`Expected a component: ${name}`);
	return status;
}

function listenerStatus(core: ReturnType<typeof createMakoo>, name: string): ListenerStatusHandle {
	const status = core.status(name);
	if ('listener' in status) throw new Error(`Expected a listener: ${name}`);
	return status;
}

const VuePanel = defineComponent({
	setup() {
		const panel = useMakooComponent();
		const play = panel.listener('play');
		return () => h('p', { class: 'vue-panel' }, `${panel.status.value}:${play.value}`);
	}
});

function ReactPanel() {
	const status = useComponentStatus();
	const play = useListenerStatus('play');
	return createElement('p', { className: 'react-panel' }, `${status}:${play}`);
}

describe('mixed Vue, React, and listener runtime', () => {
	beforeAll(() => {
		(globalThis as ActEnvironment).IS_REACT_ACT_ENVIRONMENT = true;
	});
	afterAll(() => {
		(globalThis as ActEnvironment).IS_REACT_ACT_ENVIRONMENT = false;
	});
	beforeEach(() => {
		document.body.innerHTML =
			'<section id="vue-host"></section><section id="react-host"></section><button id="vue-play"></button><button id="react-play"></button><button id="standalone"></button>';
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
		document.body.replaceChildren();
	});

	it('rejects a mixed batch before starting when a top-level name or attached name conflicts', () => {
		const core = createMakoo();
		core.useAdapter(createVueAdapter());
		core.useAdapter(createReactAdapter());
		expect(() =>
			core.apply([
				inject({
					name: 'shared',
					injectAt: '#vue-host',
					adapter: 'vue',
					component: VuePanel
				}),
				listen({
					name: 'shared',
					listenAt: '#standalone',
					type: 'click',
					callback: vi.fn()
				})
			])
		).toThrow(expect.objectContaining({ code: MakooErrorCode.INJECTION_NAME_CONFLICT }));
		expect(element('#vue-host').childElementCount).toBe(0);

		expect(() =>
			core.apply([
				inject({
					name: 'vue-panel',
					injectAt: '#vue-host',
					adapter: 'vue',
					component: VuePanel,
					listeners: [
						listen({
							name: 'play',
							listenAt: '#vue-play',
							type: 'click',
							callback: vi.fn()
						}),
						listen({
							name: 'play',
							listenAt: '#react-play',
							type: 'click',
							callback: vi.fn()
						})
					]
				})
			])
		).toThrow(expect.objectContaining({ code: MakooErrorCode.INJECTION_NAME_CONFLICT }));
		expect(element('#vue-host').childElementCount).toBe(0);
	});

	it('runs Vue, React, and a standalone listener on one core, then disposes them together', async () => {
		const standalone = vi.fn();
		const core = createMakoo();
		core.useAdapter(createVueAdapter());
		core.useAdapter(createReactAdapter());
		await act(async () => {
			core.apply([
				inject({
					name: 'vue-panel',
					injectAt: '#vue-host',
					adapter: 'vue',
					component: VuePanel,
					reinject: true,
					listeners: [
						listen({
							name: 'play',
							listenAt: '#vue-play',
							type: 'click',
							callback: vi.fn()
						})
					]
				}),
				inject({
					name: 'react-panel',
					injectAt: '#react-host',
					adapter: 'react',
					component: ReactPanel,
					reinject: true,
					listeners: [
						listen({
							name: 'play',
							listenAt: '#react-play',
							type: 'click',
							callback: vi.fn()
						})
					]
				}),
				listen({
					name: 'standalone',
					listenAt: '#standalone',
					type: 'click',
					callback: standalone
				})
			]);
		});
		await nextTick();

		expect(element('#vue-host').textContent).toBe('mounted:bound');
		expect(element('#react-host').textContent).toBe('mounted:bound');
		expect(componentStatus(core, 'vue-panel').listener('play')).toBe(
			componentStatus(core, 'vue-panel').listener('play')
		);
		expect(componentStatus(core, 'vue-panel').listenerNames).toEqual(['play']);
		expect(componentStatus(core, 'react-panel').listener('play')).not.toBe(
			componentStatus(core, 'vue-panel').listener('play')
		);
		element('#standalone').click();
		expect(standalone).toHaveBeenCalledOnce();
		expect(listenerStatus(core, 'standalone').getSnapshot()).toBe('bound');
		expect(listenerStatus(core, 'standalone').lastError).toBeUndefined();

		element('#vue-play').remove();
		await vi.waitFor(() =>
			expect(componentStatus(core, 'vue-panel').listener('play').getSnapshot()).toBe(
				'waiting'
			)
		);
		expect(componentStatus(core, 'vue-panel').getSnapshot()).toBe('mounted');
		expect(element('#react-host').textContent).toBe('mounted:bound');
		const vuePlay = document.createElement('button');
		vuePlay.id = 'vue-play';
		document.body.append(vuePlay);
		await vi.waitFor(() => expect(element('#vue-host').textContent).toBe('mounted:bound'));

		const reactHost = element('#react-host');
		const nextReactHost = document.createElement('section');
		nextReactHost.id = 'react-host';
		await act(async () => {
			reactHost.replaceWith(nextReactHost);
			await Promise.resolve();
		});
		await act(async () => {
			await vi.waitFor(
				() => expect(componentStatus(core, 'react-panel').getSnapshot()).toBe('mounted'),
				{ interval: 1 }
			);
		});
		await act(async () => {});
		expect(nextReactHost.textContent).toBe('mounted:bound');
		expect(componentStatus(core, 'vue-panel').getSnapshot()).toBe('mounted');

		await act(async () => {
			await core.command('vue-panel').stop();
		});
		await nextTick();
		expect(element('#vue-host').childElementCount).toBe(0);
		expect(element('#react-host').textContent).toBe('mounted:bound');
		element('#standalone').click();
		expect(standalone).toHaveBeenCalledTimes(2);

		await act(async () => {
			await core.dispose();
		});
		expect(document.body.querySelector('#vue-host p, #react-host p')).toBeNull();
		element('#standalone').click();
		expect(standalone).toHaveBeenCalledTimes(2);
		expect(() => core.command('standalone')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
		expect(() => core.status('react-panel')).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_NOT_FOUND })
		);
	});
});
