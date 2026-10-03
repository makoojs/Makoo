import {
	type ComponentCommand,
	type ComponentStatusHandle,
	createMakoo,
	ErrorCode,
	inject,
	type MakooError
} from '@makoojs/core';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactAdapterError } from '../src/error';
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

	it('wraps createRoot failures and normalizes non-Error causes', () => {
		reactDomClientMock.createRoot.mockImplementationOnce(() => {
			throw 'boom';
		});

		let thrown: unknown;
		try {
			createReactAdapter().mount({
				component: Badge,
				props: undefined,
				container: document.createElement('div'),
				command: {} as ComponentCommand,
				status: {} as ComponentStatusHandle
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(ReactAdapterError);
		expect(thrown).toMatchObject({ code: ErrorCode.ADAPTER_MOUNT_FAIL, cleanupErrors: [] });
		expect((thrown as MakooError).cause).toMatchObject({ message: 'boom' });
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
				status: {} as ComponentStatusHandle
			});
		} catch (error) {
			thrown = error;
		}

		expect(reactDomClientMock.root.unmount).toHaveBeenCalledOnce();
		expect(thrown).toMatchObject({ code: ErrorCode.ADAPTER_MOUNT_FAIL, cause });
		const { cleanupErrors } = thrown as MakooError;
		expect(cleanupErrors).toHaveLength(1);
		expect(cleanupErrors[0]).toMatchObject({
			code: ErrorCode.ADAPTER_UNMOUNT_FAIL,
			cause: releaseCause
		});
	});

	it('wraps unmount failures in ReactAdapterError', () => {
		const cause = new Error('root unmount failed');
		const root = {
			unmount: vi.fn(() => {
				throw cause;
			})
		} as unknown as Root;

		expect(() => createReactAdapter().unmount(root)).toThrow(
			expect.objectContaining({
				name: 'ReactAdapterError',
				code: ErrorCode.ADAPTER_UNMOUNT_FAIL,
				cause
			})
		);
	});

	it('reports a throwing root unmount as a cleanup failure in core', async () => {
		const core = createMakoo();
		core.useAdapter(createReactAdapter());
		vi.spyOn(console, 'error').mockImplementation(() => {});
		core.apply([
			inject({ name: 'badge', injectAt: '#host', adapter: 'react', component: Badge })
		]);
		reactDomClientMock.root.unmount.mockImplementationOnce(() => {
			throw new Error('root unmount failed');
		});
		const command = core.command('badge');

		await expect(command.stop()).rejects.toMatchObject({
			code: ErrorCode.ADAPTER_UNMOUNT_FAIL
		});
		expect(core.status('badge').getSnapshot()).toBe('failed');
		expect(() => command.start()).toThrow(
			expect.objectContaining({ code: ErrorCode.INJECTION_CLEANUP_FAILED })
		);
	});
});
