import { describe, expect, it } from 'vitest';
import { ReactAdapterError } from '../../react/src/error';
import { VueAdapterError } from '../../vue/src/error';
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
});

describe('AdapterError', () => {
	it('defaults code to UNKNOWN when no code is provided', () => {
		const err = new AdapterError('adapter failed');
		expect(err.code).toBe(ErrorCode.UNKNOWN);
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
	it('defaults code to UNKNOWN when no code is provided', () => {
		const err = new TaskError('task failed');
		expect(err.code).toBe(ErrorCode.UNKNOWN);
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

describe('VueAdapterError', () => {
	it('defaults code to ADAPTER_MOUNT_FAIL when no code is provided', () => {
		const err = new VueAdapterError('mount failed');
		expect(err.code).toBe(ErrorCode.ADAPTER_MOUNT_FAIL);
	});

	it('accepts ADAPTER_UNMOUNT_FAIL as explicit code', () => {
		const err = new VueAdapterError('unmount failed', undefined, ErrorCode.ADAPTER_UNMOUNT_FAIL);
		expect(err.code).toBe(ErrorCode.ADAPTER_UNMOUNT_FAIL);
	});

	it('is an instance of AdapterError and MakooError', () => {
		const err = new VueAdapterError('msg');
		expect(err).toBeInstanceOf(AdapterError);
		expect(err).toBeInstanceOf(MakooError);
	});
});

describe('ReactAdapterError', () => {
	it('defaults code to ADAPTER_MOUNT_FAIL when no code is provided', () => {
		const err = new ReactAdapterError('mount failed');
		expect(err.code).toBe(ErrorCode.ADAPTER_MOUNT_FAIL);
	});

	it('accepts ADAPTER_UNMOUNT_FAIL as explicit code', () => {
		const err = new ReactAdapterError(
			'unmount failed',
			undefined,
			ErrorCode.ADAPTER_UNMOUNT_FAIL
		);
		expect(err.code).toBe(ErrorCode.ADAPTER_UNMOUNT_FAIL);
	});

	it('is an instance of AdapterError and MakooError', () => {
		const err = new ReactAdapterError('msg');
		expect(err).toBeInstanceOf(AdapterError);
		expect(err).toBeInstanceOf(MakooError);
	});
});
