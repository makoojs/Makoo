import { ErrorCode, Injector } from '@makoo/core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactAdapterError } from '../src/error';
import { createReactAdapter } from '../src/ReactAdapter';
import type { ReactMountArtifact } from '../src/types';

const reactDomClientMock = vi.hoisted(() => {
	const root = {
		render: vi.fn(),
		unmount: vi.fn()
	};
	return {
		root,
		createRoot: vi.fn(() => root)
	};
});

vi.mock('react-dom/client', () => ({
	createRoot: reactDomClientMock.createRoot
}));

describe('ReactAdapter', () => {
	let injector: Injector;

	beforeEach(() => {
		injector = new Injector().applyAdapter(createReactAdapter());
		document.body.innerHTML = '';
	});

	afterEach(() => {
		vi.restoreAllMocks();
		reactDomClientMock.root.render.mockClear();
		reactDomClientMock.root.unmount.mockClear();
	});

	it('should mount React elements through React adapter', () => {
		const host = document.createElement('div');
		host.id = 'react-adapter';
		document.body.appendChild(host);
		const artifact: ReactMountArtifact = createElement('span', null, 'Badge');
		const result = injector.register('#react-adapter', artifact);

		injector.run();

		const context = injector.getContext();
		if (!context) throw new Error('context is undefined');
		expect(context?.getTaskStatus(result.taskId)).toBe('active');
		expect(context?.get(result.taskId, 'component')?.adapter.name).toBe('react');
		expect(reactDomClientMock.createRoot).toHaveBeenCalledWith(
			context.get(result.taskId, 'component')?.appRoot
		);
		expect(reactDomClientMock.root.render).toHaveBeenCalledWith(artifact);
	});

	it('should unmount React elements through React adapter', () => {
		const host = document.createElement('div');
		host.id = 'react-adapter';
		document.body.appendChild(host);
		const artifact: ReactMountArtifact = createElement('span', null, 'Badge');
		const result = injector.register('#react-adapter', artifact);

		injector.run();
		injector.destroy(result.taskId);

		expect(reactDomClientMock.root.unmount).toHaveBeenCalledOnce();
	});

	it('wraps mount failures in ReactAdapterError', () => {
		const host = document.createElement('div');
		const cause = new Error('root mount failed');
		reactDomClientMock.createRoot.mockImplementationOnce(() => {
			throw cause;
		});

		expect(() =>
			createReactAdapter().mount({
				host,
				mountPoint: host,
				artifact: createElement('span', null, 'Badge'),
				taskId: 'test-task',
				injectAt: '#react-adapter'
			})
		).toThrow(
			expect.objectContaining({
				name: 'ReactAdapterError',
				code: ErrorCode.ADAPTER_MOUNT_FAIL,
				cause
			})
		);
	});

	it('converts non-Error mount failures into readable adapter issues', () => {
		reactDomClientMock.createRoot.mockImplementationOnce(() => {
			throw 'boom';
		});

		try {
			createReactAdapter().mount({
				host: document.createElement('div'),
				mountPoint: document.createElement('div'),
				artifact: createElement('span', null, 'Badge'),
				taskId: 'test-task',
				injectAt: '#react-adapter'
			});
			throw new Error('expected mount to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ReactAdapterError);
			expect(error).toMatchObject({
				code: ErrorCode.ADAPTER_MOUNT_FAIL,
				cause: undefined,
				issues: [{ path: '(mount)', message: 'boom' }]
			});
		}
	});

	it('wraps unmount failures in ReactAdapterError', () => {
		const cause = new Error('root unmount failed');
		const mountPoint = document.createElement('div');
		const handle = {
			render: vi.fn(),
			unmount: vi.fn(() => {
				throw cause;
			})
		};

		expect(() =>
			createReactAdapter().unmount({
				handle,
				mountPoint,
				taskId: 'test-task',
				injectAt: '#react-adapter',
				reason: 'destroy'
			})
		).toThrow(
			expect.objectContaining({
				name: 'ReactAdapterError',
				code: ErrorCode.ADAPTER_UNMOUNT_FAIL,
				cause
			})
		);
	});

	it('converts non-Error unmount failures into readable adapter issues', () => {
		const mountPoint = document.createElement('div');
		const handle = {
			render: vi.fn(),
			unmount: vi.fn(() => {
				throw 'unmount exploded';
			})
		};

		try {
			createReactAdapter().unmount({
				handle,
				mountPoint,
				taskId: 'test-task',
				injectAt: '#react-adapter',
				reason: 'destroy'
			});
			throw new Error('expected unmount to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ReactAdapterError);
			expect(error).toMatchObject({
				code: ErrorCode.ADAPTER_UNMOUNT_FAIL,
				cause: undefined,
				issues: [{ path: '(unmount)', message: 'unmount exploded' }]
			});
		}
	});
});
