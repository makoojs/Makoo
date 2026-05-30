import { describe, expect, it } from 'vitest';
import { AdapterError } from '../src/error/AdapterError';
import { ErrorCode } from '../src/error/ErrorCode';
import { MakooError } from '../src/error/MakooError';
import { TaskError } from '../src/error/TaskError';

describe('MakooError', () => {
	it('defaults code to UNKNOWN when no code is provided', () => {
		const err = new MakooError('something failed');
		expect(err.code).toBe(ErrorCode.UNKNOWN);
	});

	it('uses provided code when explicitly specified', () => {
		const err = new MakooError('something failed', undefined, ErrorCode.ADAPTER_NOT_FOUND);
		expect(err.code).toBe(ErrorCode.ADAPTER_NOT_FOUND);
	});

	it('appends cause chain to formatted message', () => {
		const root = new Error('root problem');
		const err = new MakooError('outer error', undefined, undefined, root);
		expect(err.message).toContain('cause: root problem');
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
});

describe('AdapterError', () => {
	it('defaults code to ADAPTER_NOT_FOUND when no code is provided', () => {
		const err = new AdapterError('adapter failed');
		expect(err.code).toBe(ErrorCode.ADAPTER_NOT_FOUND);
	});

	it('uses provided code when explicitly specified', () => {
		const err = new AdapterError('not found', undefined, ErrorCode.ADAPTER_NOT_FOUND);
		expect(err.code).toBe(ErrorCode.ADAPTER_NOT_FOUND);
	});

	it('is an instance of MakooError and Error', () => {
		const err = new AdapterError('msg', undefined, ErrorCode.ADAPTER_NOT_FOUND);
		expect(err).toBeInstanceOf(MakooError);
		expect(err).toBeInstanceOf(Error);
	});
});

describe('TaskError', () => {
	it('defaults code to TASK_NO_REGISTERED when no code is provided', () => {
		const err = new TaskError('task failed');
		expect(err.code).toBe(ErrorCode.TASK_NO_REGISTERED);
	});

	it('uses provided code when explicitly specified', () => {
		const err = new TaskError('no tasks', undefined, ErrorCode.TASK_NO_REGISTERED);
		expect(err.code).toBe(ErrorCode.TASK_NO_REGISTERED);
	});

	it('is an instance of MakooError and Error', () => {
		const err = new TaskError('msg', undefined, ErrorCode.TASK_NO_REGISTERED);
		expect(err).toBeInstanceOf(MakooError);
		expect(err).toBeInstanceOf(Error);
	});
});
