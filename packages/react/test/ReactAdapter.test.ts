import { Injector } from '@makoo/core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReactAdapter } from '../src/ReactAdapter';
import type { ReactMountArtifact } from '../src/type';

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
});
