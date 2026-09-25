import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakoo, ErrorCode, listen, MakooError } from '../src';

describe('createMakoo', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('should start listener declarations', async () => {
		const button = document.createElement('button');
		button.id = 'listener-button';
		document.body.appendChild(button);
		const callback = vi.fn();
		const makoo = createMakoo();

		makoo.apply([
			listen({
				name: 'listener',
				listenAt: '#listener-button',
				type: 'click',
				callback
			})
		]);

		button.click();
		expect(callback).toHaveBeenCalledTimes(1);
		await makoo.get('listener').stop();
	});

	it('should start object-form listener declarations with explicit name', async () => {
		const button = document.createElement('button');
		button.id = 'object-listener-button';
		document.body.appendChild(button);
		const callback = vi.fn();
		const makoo = createMakoo();

		makoo.apply([
			listen({
				name: 'object-listener',
				listenAt: '#object-listener-button',
				type: 'click',
				callback
			})
		]);

		button.click();
		expect(callback).toHaveBeenCalledOnce();
		await makoo.get('object-listener').stop();
	});

	it('should reject an empty declaration batch', () => {
		const makoo = createMakoo();

		expect(() => makoo.apply([])).toThrow(MakooError);

		try {
			makoo.apply([]);
		} catch (error) {
			expect(error).toBeInstanceOf(MakooError);
			expect((error as MakooError).code).toBe(ErrorCode.INVALID_DECLARATION);
		}
	});
});
