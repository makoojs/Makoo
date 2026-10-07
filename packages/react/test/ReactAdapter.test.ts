import {
	type AdapterMountParams,
	type ComponentCommand,
	type ComponentStatusHandle,
	createMakoo,
	inject,
	MakooAggregateError,
	MakooErrorCode
} from '@makoojs/core';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReactAdapter } from '../src/ReactAdapter';

const reactDomClientMock = vi.hoisted(() => {
	const root = {
		render: vi.fn(),
		unmount: vi.fn()
	};
	return {
		root,
		createRoot: vi.fn((_container: HTMLElement) => root)
	};
});

vi.mock('react-dom/client', () => ({
	createRoot: reactDomClientMock.createRoot
}));

function Badge() {
	return 'Badge';
}

describe('ReactAdapter', () => {
	beforeEach(() => {
		document.body.innerHTML = '<section id="host"></section>';
	});

	afterEach(() => {
		vi.restoreAllMocks();
		reactDomClientMock.createRoot.mockClear();
		reactDomClientMock.root.render.mockReset();
		reactDomClientMock.root.unmount.mockReset();
	});

	it('creates its root in the core container and unmounts that root on stop', async () => {
		const core = createMakoo();
		core.useAdapter(createReactAdapter());

		core.apply([
			inject({ name: 'badge', injectAt: '#host', adapter: 'react', component: Badge })
		]);
		const command = core.command('badge');

		const container = reactDomClientMock.createRoot.mock.calls[0]?.[0];
		expect(container?.parentElement?.id).toBe('host');
		expect(core.status('badge').getSnapshot()).toBe('mounted');

		await command.stop();
		expect(reactDomClientMock.root.unmount).toHaveBeenCalledOnce();
	});

	it('treats a returned root as mounted without waiting for React to commit', () => {
		const core = createMakoo();
		core.useAdapter(createReactAdapter());
		core.apply([
			inject({ name: 'badge', injectAt: '#host', adapter: 'react', component: Badge })
		]);

		expect(reactDomClientMock.root.render).toHaveBeenCalledOnce();
		expect(core.status('badge').getSnapshot()).toBe('mounted');
	});

	it('rethrows a createRoot failure unchanged, including a non-Error cause', () => {
		reactDomClientMock.createRoot.mockImplementationOnce(() => {
			throw 'boom';
		});

		expect(() =>
			createReactAdapter().mount({
				component: Badge,
				props: undefined,
				container: document.createElement('div'),
				command: {} as ComponentCommand,
				status: {} as ComponentStatusHandle,
				globalListener: () => ({}) as ReturnType<AdapterMountParams['globalListener']>
			})
		).toThrow('boom');
	});

	it('unmounts the created root when render throws and reports a failed cleanup', () => {
		const cause = new Error('render failed');
		const releaseCause = new Error('root unmount failed');
		reactDomClientMock.root.render.mockImplementationOnce(() => {
			throw cause;
		});
		reactDomClientMock.root.unmount.mockImplementationOnce(() => {
			throw releaseCause;
		});

		let thrown: unknown;
		try {
			createReactAdapter().mount({
				component: Badge,
				props: undefined,
				container: document.createElement('div'),
				command: {} as ComponentCommand,
				status: {} as ComponentStatusHandle,
				globalListener: () => ({}) as ReturnType<AdapterMountParams['globalListener']>
			});
		} catch (error) {
			thrown = error;
		}

		expect(reactDomClientMock.root.unmount).toHaveBeenCalledOnce();
		expect(thrown).toBeInstanceOf(MakooAggregateError);
		expect(thrown).toMatchObject({
			code: MakooErrorCode.MOUNT_CLEANUP_FAILED,
			cause,
			errors: [releaseCause]
		});
	});

	it('rethrows an unmount failure unchanged', () => {
		const cause = new Error('root unmount failed');
		const root = {
			unmount: vi.fn(() => {
				throw cause;
			})
		} as unknown as Root;

		expect(() => createReactAdapter().unmount(root)).toThrow(cause);
	});

	it('reports a render failure through core with the original cause', async () => {
		const cause = new Error('render failed');
		reactDomClientMock.root.render.mockImplementationOnce(() => {
			throw cause;
		});
		const core = createMakoo();
		core.useAdapter(createReactAdapter());
		vi.spyOn(console, 'error').mockImplementation(() => {});
		core.apply([
			inject({ name: 'badge', injectAt: '#host', adapter: 'react', component: Badge })
		]);

		await vi.waitFor(() => expect(core.status('badge').getSnapshot()).toBe('failed'));
		expect(reactDomClientMock.root.unmount).toHaveBeenCalledOnce();
		expect(core.status('badge').lastError).toMatchObject({
			code: MakooErrorCode.MOUNT_FAILED,
			cause
		});
	});

	it('reports a throwing root unmount as a cleanup failure in core', async () => {
		const cause = new Error('root unmount failed');
		const core = createMakoo();
		core.useAdapter(createReactAdapter());
		vi.spyOn(console, 'error').mockImplementation(() => {});
		core.apply([
			inject({ name: 'badge', injectAt: '#host', adapter: 'react', component: Badge })
		]);
		reactDomClientMock.root.unmount.mockImplementationOnce(() => {
			throw cause;
		});
		const command = core.command('badge');

		await expect(command.stop()).rejects.toMatchObject({
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
			errors: [expect.objectContaining({ code: MakooErrorCode.UNMOUNT_FAILED, cause })]
		});
		expect(core.status('badge').getSnapshot()).toBe('failed');
		expect(() => command.start()).toThrow(
			expect.objectContaining({ code: MakooErrorCode.INJECTION_CLOSED })
		);
	});
});
