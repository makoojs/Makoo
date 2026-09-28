import {
	type ComponentControl,
	createMakoo,
	ErrorCode,
	inject,
	type MakooError
} from '@makoojs/core';
import { isValidElement, type ReactElement } from 'react';
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

function Badge(_props: { title: string }) {
	return 'Badge';
}

function renderedChild(): ReactElement<{ title: string }> {
	const provider = reactDomClientMock.root.render.mock.calls[0]?.[0] as ReactElement<{
		value: ComponentControl;
		children: ReactElement<{ title: string }>;
	}>;
	return provider.props.children;
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

	it('renders the selected component with props and control into the core container', async () => {
		const core = createMakoo();
		core.useAdapter(createReactAdapter());
		const data = { items: [1] };

		core.apply([
			inject({
				name: 'badge',
				injectAt: '#host',
				adapter: 'react',
				component: Badge,
				props: { title: 'hello', data }
			})
		]);
		const control = core.get('badge');

		const container = reactDomClientMock.createRoot.mock.calls[0]?.[0];
		expect(container?.parentElement?.id).toBe('host');
		const provider = reactDomClientMock.root.render.mock.calls[0]?.[0];
		expect(isValidElement(provider)).toBe(true);
		expect(provider.props.value).toBe(control);
		expect(renderedChild().type).toBe(Badge);
		expect(renderedChild().props).toMatchObject({ title: 'hello', data });
		expect(Object.isFrozen(data)).toBe(false);
		expect(control.state.getSnapshot().status).toBe('mounted');

		await control.stop();
		expect(reactDomClientMock.root.unmount).toHaveBeenCalledOnce();
	});

	it('treats a returned root as mounted without waiting for React to commit', () => {
		const core = createMakoo();
		core.useAdapter(createReactAdapter());
		core.apply([
			inject({ name: 'badge', injectAt: '#host', adapter: 'react', component: Badge })
		]);

		expect(reactDomClientMock.root.render).toHaveBeenCalledOnce();
		expect(core.get('badge').state.getSnapshot().status).toBe('mounted');
	});

	it('wraps createRoot failures and normalizes non-Error causes', () => {
		reactDomClientMock.createRoot.mockImplementationOnce(() => {
			throw 'boom';
		});

		let thrown: unknown;
		try {
			createReactAdapter().mount({
				component: Badge,
				listenerNames: [],
				props: undefined,
				container: document.createElement('div'),
				control: {} as ComponentControl
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
				listenerNames: [],
				props: undefined,
				container: document.createElement('div'),
				control: {} as ComponentControl
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
		const control = core.get('badge');

		await expect(control.stop()).rejects.toMatchObject({
			code: ErrorCode.ADAPTER_UNMOUNT_FAIL
		});
		expect(control.state.getSnapshot().status).toBe('failed');
		expect(() => control.start()).toThrow(
			expect.objectContaining({ code: ErrorCode.INJECTION_CLEANUP_FAILED })
		);
	});
});
