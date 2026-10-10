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

describe('MakooErrorCode', () => {
	it('publishes the core codes from the error spec', () => {
		expect(MakooErrorCode).toEqual({
			DECLARATION_INVALID: 'MAKOO_DECLARATION_INVALID',
			INJECTION_NAME_CONFLICT: 'MAKOO_INJECTION_NAME_CONFLICT',
			ADAPTER_INVALID: 'MAKOO_ADAPTER_INVALID',
			ADAPTER_NAME_CONFLICT: 'MAKOO_ADAPTER_NAME_CONFLICT',
			ADAPTER_NOT_FOUND: 'MAKOO_ADAPTER_NOT_FOUND',
			INJECTION_NOT_FOUND: 'MAKOO_INJECTION_NOT_FOUND',
			LISTENER_NOT_FOUND: 'MAKOO_LISTENER_NOT_FOUND',
			INJECTION_REMOVED: 'MAKOO_INJECTION_REMOVED',
			INJECTION_CLOSED: 'MAKOO_INJECTION_CLOSED',
			INSTANCE_DISPOSED: 'MAKOO_INSTANCE_DISPOSED',
			TARGET_WAIT_TIMEOUT: 'MAKOO_TARGET_WAIT_TIMEOUT',
			MOUNT_TARGET_DETACHED: 'MAKOO_MOUNT_TARGET_DETACHED',
			MOUNT_FAILED: 'MAKOO_MOUNT_FAILED',
			LISTENER_TARGET_DETACHED: 'MAKOO_LISTENER_TARGET_DETACHED',
			LISTENER_BIND_FAILED: 'MAKOO_LISTENER_BIND_FAILED',
			ATTACHED_LISTENER_FAILED: 'MAKOO_ATTACHED_LISTENER_FAILED',
			UNMOUNT_FAILED: 'MAKOO_UNMOUNT_FAILED',
			CONTAINER_REMOVE_FAILED: 'MAKOO_CONTAINER_REMOVE_FAILED',
			LISTENER_UNBIND_FAILED: 'MAKOO_LISTENER_UNBIND_FAILED',
			MOUNT_CLEANUP_FAILED: 'MAKOO_MOUNT_CLEANUP_FAILED',
			INJECTION_CLEANUP_FAILED: 'MAKOO_INJECTION_CLEANUP_FAILED',
			INSTANCE_CLEANUP_FAILED: 'MAKOO_INSTANCE_CLEANUP_FAILED',
			LISTENER_CALLBACK_FAILED: 'MAKOO_LISTENER_CALLBACK_FAILED',
			STATE_SUBSCRIBER_FAILED: 'MAKOO_STATE_SUBSCRIBER_FAILED'
		});
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

		expect(error).toBeInstanceOf(Error);
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
