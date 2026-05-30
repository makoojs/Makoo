import { ErrorCode, MakooError } from '@makoo/core';
import { describe, expect, it } from 'vitest';
import {
	ComponentNotFoundError,
	ConfigValidationError,
	LoadViteMakooConfigError,
	ManifestLoadError,
	ManifestNotFoundError,
	ModuleAlreadyExistsError,
	ModuleManifestLoadError,
	NoEnabledInjectionsError,
	SourceDirNotFoundError,
	toMakooIssue,
	UnknownFrameworkError,
	UnsupportedFrameworkGenerationError,
	type ValidationIssue
} from '../src/error/error';

describe('ModuleAlreadyExistsError', () => {
	it('defaults code to CLI_MODULE_ALREADY_EXISTS', () => {
		const err = new ModuleAlreadyExistsError('Module "foo" already exists');
		expect(err.code).toBe(ErrorCode.CLI_MODULE_ALREADY_EXISTS);
		expect(err.name).toBe('ModuleAlreadyExistsError');
		expect(err).toBeInstanceOf(MakooError);
	});

	it('accepts custom code and cause', () => {
		const cause = new Error('inner');
		const err = new ModuleAlreadyExistsError('msg', 'CUSTOM_CODE', cause);
		expect(err.code).toBe('CUSTOM_CODE');
		expect(err.cause).toBe(cause);
	});
});

describe('LoadViteMakooConfigError', () => {
	it('requires code parameter', () => {
		const err = new LoadViteMakooConfigError('config load failed', 'SOME_CODE');
		expect(err.code).toBe('SOME_CODE');
		expect(err.name).toBe('LoadViteMakooConfigError');
		expect(err).toBeInstanceOf(MakooError);
	});

	it('accepts cause', () => {
		const cause = new Error('inner');
		const err = new LoadViteMakooConfigError('msg', 'CODE', cause);
		expect(err.cause).toBe(cause);
	});
});

describe('ConfigValidationError', () => {
	it('defaults code to CLI_CONFIG_INVALID', () => {
		const err = new ConfigValidationError([{ path: 'field', message: 'bad' }]);
		expect(err.code).toBe(ErrorCode.CLI_CONFIG_INVALID);
		expect(err.name).toBe('ConfigValidationError');
		expect(err.issues).toHaveLength(1);
	});

	it('accepts custom code and cause', () => {
		const cause = new Error('inner');
		const err = new ConfigValidationError([], 'CUSTOM', cause);
		expect(err.code).toBe('CUSTOM');
		expect(err.cause).toBe(cause);
	});
});

describe('UnknownFrameworkError', () => {
	it('defaults code to CLI_UNKNOWN_FRAMEWORK', () => {
		const err = new UnknownFrameworkError('./foo.tsx');
		expect(err.code).toBe(ErrorCode.CLI_UNKNOWN_FRAMEWORK);
		expect(err.name).toBe('UnknownFrameworkError');
		expect(err.message).toContain('./foo.tsx');
	});

	it('accepts custom code and cause', () => {
		const cause = new Error('inner');
		const err = new UnknownFrameworkError('./bar.vue', 'CUSTOM', cause);
		expect(err.code).toBe('CUSTOM');
		expect(err.cause).toBe(cause);
	});
});

describe('ComponentNotFoundError', () => {
	it('defaults code to CLI_COMPONENT_NOT_FOUND', () => {
		const err = new ComponentNotFoundError('header');
		expect(err.code).toBe(ErrorCode.CLI_COMPONENT_NOT_FOUND);
		expect(err.name).toBe('ComponentNotFoundError');
		expect(err.message).toContain('header');
	});

	it('accepts custom code and cause', () => {
		const cause = new Error('inner');
		const err = new ComponentNotFoundError('sidebar', 'CUSTOM', cause);
		expect(err.code).toBe('CUSTOM');
		expect(err.cause).toBe(cause);
	});
});

describe('UnsupportedFrameworkGenerationError', () => {
	it('defaults code to CLI_UNSUPPORTED_FRAMEWORK', () => {
		const err = new UnsupportedFrameworkGenerationError('Svelte');
		expect(err.code).toBe(ErrorCode.CLI_UNSUPPORTED_FRAMEWORK);
		expect(err.name).toBe('UnsupportedFrameworkError');
		expect(err.message).toContain('Svelte');
	});

	it('accepts custom code and cause', () => {
		const cause = new Error('inner');
		const err = new UnsupportedFrameworkGenerationError('Angular', 'CUSTOM', cause);
		expect(err.code).toBe('CUSTOM');
		expect(err.cause).toBe(cause);
	});
});

describe('SourceDirNotFoundError', () => {
	it('defaults code to CLI_SOURCE_DIR_NOT_FOUND', () => {
		const err = new SourceDirNotFoundError('/src/injections');
		expect(err.code).toBe(ErrorCode.CLI_SOURCE_DIR_NOT_FOUND);
		expect(err.name).toBe('SourceDirNotFoundError');
		expect(err.message).toContain('/src/injections');
	});

	it('accepts custom code and cause', () => {
		const cause = new Error('inner');
		const err = new SourceDirNotFoundError('/dir', 'CUSTOM', cause);
		expect(err.code).toBe('CUSTOM');
		expect(err.cause).toBe(cause);
	});
});

describe('ManifestNotFoundError', () => {
	it('defaults code to CLI_MANIFEST_NOT_FOUND', () => {
		const err = new ManifestNotFoundError('/src/injections');
		expect(err.code).toBe(ErrorCode.CLI_MANIFEST_NOT_FOUND);
		expect(err.name).toBe('ManifestNotFoundError');
		expect(err.message).toContain('/src/injections');
	});

	it('accepts custom code and cause', () => {
		const cause = new Error('inner');
		const err = new ManifestNotFoundError('/dir', 'CUSTOM', cause);
		expect(err.code).toBe('CUSTOM');
		expect(err.cause).toBe(cause);
	});
});

describe('ManifestLoadError', () => {
	it('defaults code to CLI_MANIFEST_LOAD_FAIL', () => {
		const err = new ManifestLoadError('/path/manifest.ts');
		expect(err.code).toBe(ErrorCode.CLI_MANIFEST_LOAD_FAIL);
		expect(err.name).toBe('ManifestLoadError');
		expect(err.message).toContain('/path/manifest.ts');
	});

	it('includes cause message in issues when cause is Error', () => {
		const cause = new Error('import failed');
		const err = new ManifestLoadError('/path/manifest.ts', undefined, cause);
		expect(err.issues[0].message).toBe('import failed');
		expect(err.cause).toBe(cause);
	});

	it('handles non-Error cause', () => {
		const err = new ManifestLoadError(
			'/path/manifest.ts',
			undefined,
			'string error' as unknown as Error
		);
		expect(err.issues[0].message).toBe('string error');
	});
});

describe('ModuleManifestLoadError', () => {
	it('defaults code to CLI_MODULE_MANIFEST_LOAD_FAIL', () => {
		const err = new ModuleManifestLoadError('/path/module/manifest.ts');
		expect(err.code).toBe(ErrorCode.CLI_MODULE_MANIFEST_LOAD_FAIL);
		expect(err.name).toBe('ModuleManifestLoadError');
		expect(err.message).toContain('/path/module/manifest.ts');
	});

	it('includes cause message in issues when cause is Error', () => {
		const cause = new Error('module load failed');
		const err = new ModuleManifestLoadError('/path/manifest.ts', undefined, cause);
		expect(err.issues[0].message).toBe('module load failed');
		expect(err.cause).toBe(cause);
	});
});

describe('NoEnabledInjectionsError', () => {
	it('defaults code to CLI_NO_ENABLED_INJECTIONS', () => {
		const err = new NoEnabledInjectionsError();
		expect(err.code).toBe(ErrorCode.CLI_NO_ENABLED_INJECTIONS);
		expect(err.name).toBe('NoEnabledInjectionsError');
		expect(err.message).toContain('No enabled injections');
	});

	it('accepts custom code and cause', () => {
		const cause = new Error('inner');
		const err = new NoEnabledInjectionsError('CUSTOM', cause);
		expect(err.code).toBe('CUSTOM');
		expect(err.cause).toBe(cause);
	});
});

describe('toMakooIssue', () => {
	it('formats zod issue path', () => {
		const issue: ValidationIssue = {
			path: ['injections', 0, 'injectAt'],
			message: 'is required',
			code: 'custom'
		};
		const result = toMakooIssue(issue);
		expect(result.path).toBe('injections.[0].injectAt');
		expect(result.message).toBe('is required');
	});

	it('returns (root) for empty path', () => {
		const issue: ValidationIssue = { path: [], message: 'bad', code: 'custom' };
		expect(toMakooIssue(issue).path).toBe('(root)');
	});

	it('converts "received undefined" to "is required"', () => {
		const issue: ValidationIssue = {
			path: ['field'],
			message: 'Expected string, received undefined',
			code: 'invalid_type'
		};
		expect(toMakooIssue(issue).message).toBe('is required');
	});

	it('preserves other messages as-is', () => {
		const issue: ValidationIssue = { path: ['x'], message: 'must be a number', code: 'custom' };
		expect(toMakooIssue(issue).message).toBe('must be a number');
	});
});
