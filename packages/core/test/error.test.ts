import { describe, expect, it } from 'vitest';
import { coreErrors, isMakooError, MakooAggregateError, MakooError, MakooErrorCode } from '../src';
import { coreErrorTable } from '../src/error/coreErrors';

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
			STATE_SUBSCRIBER_FAILED: 'MAKOO_STATE_SUBSCRIBER_FAILED',
			INSTANCE_OBSERVER_FAILED: 'MAKOO_INSTANCE_OBSERVER_FAILED'
		});
	});
});

describe('coreErrors', () => {
	it('creates an error carrying code, category, details and the table message', () => {
		const error = coreErrors.create('MAKOO_TARGET_WAIT_TIMEOUT', {
			name: 'panel',
			selector: '#host',
			timeout: 15000
		});

		expect(error).toBeInstanceOf(MakooError);
		expect(error.code).toBe('MAKOO_TARGET_WAIT_TIMEOUT');
		expect(error.category).toBe('execution');
		expect(error.details).toEqual({
			name: 'panel',
			selector: '#host',
			timeout: 15000
		});
		expect(error.message).toContain('panel');
	});

	it('creates detail-less errors without passing details', () => {
		const error = coreErrors.create('MAKOO_INSTANCE_DISPOSED');

		expect(error.code).toBe('MAKOO_INSTANCE_DISPOSED');
		expect(error.category).toBe('control');
		expect(error.details).toBeUndefined();
		expect(error.message).toBe('Core instance is disposed');
	});

	it('keeps cause and aggregates errors with one line per direct error', () => {
		const child = coreErrors.create('MAKOO_UNMOUNT_FAILED', { name: 'panel' });
		const cause = new Error('root');
		const error = coreErrors.create(
			'MAKOO_INJECTION_CLEANUP_FAILED',
			{ name: 'panel' },
			{ cause, errors: [child, 'plain'] }
		);

		expect(error.code).toBe('MAKOO_INJECTION_CLEANUP_FAILED');
		expect(error.category).toBe('cleanup');
		expect(error.cause).toBe(cause);
		expect(error.errors).toEqual([child, 'plain']);
		expect(error.message).toBe(
			['Cleanup failed for "panel"', 'Failed to unmount "panel"', 'plain'].join('\n')
		);
	});

	it('exposes createThrowable for configuration and control codes', () => {
		const error = coreErrors.createThrowable('MAKOO_INJECTION_REMOVED', { name: 'panel' });

		expect(error.code).toBe('MAKOO_INJECTION_REMOVED');
		expect(error.category).toBe('control');
	});

	it('takes options directly for detail-less rows, including aggregate errors', () => {
		const cause = new Error('root');
		const plain = coreErrors.create('MAKOO_INSTANCE_DISPOSED', { cause });
		const aggregate = coreErrors.create('MAKOO_INSTANCE_CLEANUP_FAILED', {
			errors: ['a', 'b']
		});

		expect(plain.cause).toBe(cause);
		expect(aggregate.errors).toEqual(['a', 'b']);
		expect(aggregate.message).toBe(['Failed to dispose core', 'a', 'b'].join('\n'));
	});

	it('keeps every legacy MakooErrorCode covered by the table', () => {
		expect(Object.keys(coreErrorTable)).toEqual(
			expect.arrayContaining(Object.values(MakooErrorCode))
		);
		expect(Object.values(MakooErrorCode)).toHaveLength(Object.keys(coreErrorTable).length);
	});
});

describe('isMakooError', () => {
	it('accepts errors built both ways and foreign-marked objects', () => {
		expect(isMakooError(new MakooError('m', { code: 'X' }))).toBe(true);
		expect(isMakooError(coreErrors.create('MAKOO_INSTANCE_DISPOSED'))).toBe(true);
		expect(isMakooError({ [Symbol.for('makoo.error')]: true, code: 'MAKOO_X' })).toBe(true);
	});

	it('rejects plain errors, non-error values and lookalikes', () => {
		expect(isMakooError(new Error('x'))).toBe(false);
		expect(isMakooError({ code: 'MAKOO_X' })).toBe(false);
		expect(isMakooError(null)).toBe(false);
		expect(isMakooError('MAKOO_X')).toBe(false);
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
