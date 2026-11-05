import { describe, expect, it } from 'vitest';
import { coreErrors, isMakooError, MakooError } from '../src';

describe('MakooError', () => {
	it('keeps the message unchanged and requires a code', () => {
		const error = new MakooError('something failed', {
			code: 'MAKOO_ADAPTER_NOT_FOUND'
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
			code: 'MAKOO_MOUNT_FAILED',
			cause: root
		});
		const withValue = new MakooError('outer error', {
			code: 'MAKOO_MOUNT_FAILED',
			cause: 'raw'
		});

		expect(withError.message).toBe('outer error');
		expect(withError.cause).toBe(root);
		expect(withValue.cause).toBe('raw');
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
		const configuration = coreErrors.createThrowable('MAKOO_ADAPTER_NOT_FOUND', {
			name: 'vue'
		});
		const control = coreErrors.createThrowable('MAKOO_INJECTION_REMOVED', { name: 'panel' });

		expect(configuration.category).toBe('configuration');
		expect(control.code).toBe('MAKOO_INJECTION_REMOVED');
		expect(control.category).toBe('control');
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
