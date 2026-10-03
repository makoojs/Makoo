import { ErrorCode, MakooError } from '@makoojs/core';
import { describe, expect, it } from 'vitest';
import { VueAdapterError } from '../src/error';

describe('VueAdapterError', () => {
	it('defaults code to ADAPTER_MOUNT_FAIL when no code is provided', () => {
		const err = new VueAdapterError('mount failed');
		expect(err.code).toBe(ErrorCode.ADAPTER_MOUNT_FAIL);
	});

	it('accepts ADAPTER_UNMOUNT_FAIL as explicit code', () => {
		const err = new VueAdapterError(
			'unmount failed',
			undefined,
			ErrorCode.ADAPTER_UNMOUNT_FAIL
		);
		expect(err.code).toBe(ErrorCode.ADAPTER_UNMOUNT_FAIL);
	});

	it('is an instance of MakooError', () => {
		const err = new VueAdapterError('msg');
		expect(err).toBeInstanceOf(MakooError);
	});
});
