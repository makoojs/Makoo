import { describe, expect, it } from 'vitest';
import { MakooAggregateError, MakooError, MakooErrorCode } from '../src';

describe('MakooError', () => {
	it('keeps the message unchanged and requires a code', () => {
		const error = new MakooError('something failed', {
			code: MakooErrorCode.ADAPTER_NOT_FOUND
		});

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(MakooError);
		expect(error.name).toBe('MakooError');
		expect(error.message).toBe('something failed');
		expect(error.code).toBe('MAKOO_ADAPTER_NOT_FOUND');
		expect(Object.hasOwn(error, 'cause')).toBe(false);
	});

	it('keeps an error or a non-error cause without adding it to the message', () => {
		const root = new Error('root problem');
		const withError = new MakooError('outer error', {
			code: MakooErrorCode.MOUNT_FAILED,
			cause: root
		});
		const withValue = new MakooError('outer error', {
			code: MakooErrorCode.MOUNT_FAILED,
			cause: 'raw'
		});

		expect(withError.message).toBe('outer error');
		expect(withError.cause).toBe(root);
		expect(withValue.cause).toBe('raw');
	});
});

describe('MakooAggregateError', () => {
	it('is a Makoo error that keeps every given error and lists each on its own line', () => {
		const child = new MakooError('Failed to bind listener "save"', {
			code: MakooErrorCode.LISTENER_BIND_FAILED
		});
		const nested = new MakooAggregateError([child], 'Cleanup failed for listener "save"', {
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED
		});
		const given = [nested, 'plain'];
		const error = new MakooAggregateError(given, 'Cleanup failed for "toolbar"', {
			code: MakooErrorCode.INJECTION_CLEANUP_FAILED,
			cause: child
		});

		expect(error).toBeInstanceOf(MakooError);
		expect(error).toBeInstanceOf(MakooAggregateError);
		expect(error.name).toBe('MakooAggregateError');
		expect(error.code).toBe(MakooErrorCode.INJECTION_CLEANUP_FAILED);
		expect(error.cause).toBe(child);
		expect(error.errors).toBe(given);
		expect(error.message).toBe(
			['Cleanup failed for "toolbar"', 'Cleanup failed for listener "save"', 'plain'].join(
				'\n'
			)
		);
	});
});
