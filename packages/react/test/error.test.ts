import { AdapterError, ErrorCode, MakooError } from '@makoojs/core';
import { describe, expect, it } from 'vitest';
import { ReactAdapterError } from '../src/error';

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
