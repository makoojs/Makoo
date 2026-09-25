import { describe, expect, it } from 'vitest';
import { ErrorCode, MakooError } from '../src';

describe('MakooError', () => {
	it('defaults code to UNKNOWN when no code is provided', () => {
		const err = new MakooError('something failed');
		expect(err.code).toBe(ErrorCode.UNKNOWN);
	});

	it('uses provided code when explicitly specified', () => {
		const err = new MakooError('something failed', undefined, ErrorCode.ADAPTER_NOT_FOUND);
		expect(err.code).toBe(ErrorCode.ADAPTER_NOT_FOUND);
	});

	it('retains cause without appending it to the message', () => {
		const root = new Error('root problem');
		const err = new MakooError('outer error', undefined, undefined, root);
		expect(err.message).toBe('[makoo] outer error');
		expect(err.cause).toBe(root);
	});

	it('formats message with issues', () => {
		const err = new MakooError('Something went wrong', [
			{ path: 'foo.bar', message: 'is required' },
			{ path: 'baz', message: 'must be one of "a", "b"' }
		]);
		expect(err.message).toContain('[makoo] Something went wrong');
		expect(err.message).toContain('- foo.bar: is required');
		expect(err.message).toContain('- baz: must be one of "a", "b"');
		expect(err).toBeInstanceOf(Error);
	});

	it('formats message without issues', () => {
		const err = new MakooError('Something went wrong');
		expect(err.message).toBe('[makoo] Something went wrong');
	});

	it('exposes issues for programmatic access', () => {
		const issues = [{ path: 'x', message: 'bad' }];
		const err = new MakooError('msg', issues);
		expect(err.issues).toBe(issues);
	});

	it('merges structured context without replacing the error', () => {
		const err = new MakooError('msg');

		expect(
			err.withContext({
				taskId: 'main-panel',
				component: 'Panel',
				injectAt: 'body',
				adapter: 'vue'
			})
		).toBe(err);
		expect(err.context).toEqual({
			taskId: 'main-panel',
			component: 'Panel',
			injectAt: 'body',
			adapter: 'vue'
		});
	});
});
