import { describe, expect, it } from 'vitest';
import { AdapterError } from '../src/error/AdapterError';
import { ErrorCode } from '../src/error/ErrorCode';
import { formatMakooError } from '../src/error/formatMakooError';
import { MakooError } from '../src/error/MakooError';
import { SignalError } from '../src/error/SignalError';
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
				artifact: 'Panel',
				injectAt: 'body',
				adapter: 'vue'
			})
		).toBe(err);
		expect(err.context).toEqual({
			taskId: 'main-panel',
			artifact: 'Panel',
			injectAt: 'body',
			adapter: 'vue'
		});
	});
});

describe('formatMakooError', () => {
	it('formats the error, context and original cause as one readable message', () => {
		const cause = new TypeError("Cannot read properties of null (reading 'toString')");
		cause.stack = [
			"TypeError: Cannot read properties of null (reading 'toString')",
			'    at Object.mount (@makoojs_vue.js:47:15)',
			'    at injectArtifact (TaskRunner.ts:479:25)'
		].join('\n');
		const error = new AdapterError(
			'Failed to mount Vue component at "body"',
			undefined,
			ErrorCode.ADAPTER_MOUNT_FAIL,
			cause
		).withContext({
			taskId: 'main-panel',
			artifact: 'Panel',
			injectAt: 'body',
			adapter: 'vue'
		});

		expect(formatMakooError(error)).toBe(
			[
				'AdapterError [MAKOO_ADAPTER_MOUNT_FAIL]:',
				'Failed to mount Vue component at "body"',
				'(taskId: "main-panel", artifact: "Panel", injectAt: "body", adapter: "vue")',
				'',
				"  TypeError: Cannot read properties of null (reading 'toString')",
				'      at Object.mount (@makoojs_vue.js:47:15)',
				'      at injectArtifact (TaskRunner.ts:479:25)'
			].join('\n')
		);
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

describe('SignalError', () => {
	it('defaults code to TASK_SIGNAL_INVALID when no code is provided', () => {
		const err = new SignalError('signal failed');
		expect(err.code).toBe(ErrorCode.TASK_SIGNAL_INVALID);
	});

	it('is an instance of MakooError and Error', () => {
		const err = new SignalError('msg');
		expect(err).toBeInstanceOf(MakooError);
		expect(err).toBeInstanceOf(Error);
	});
});
