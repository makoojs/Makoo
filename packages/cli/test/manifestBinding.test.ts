import { ErrorCode, MakooError } from '@makoojs/core';
import { describe, expect, it } from 'vitest';
import type { ResolvedInjectionModule } from '../src/config/types';
import { buildManifestBindings } from '../src/scanner/manifestBinding';

describe('buildManifestBindings', () => {
	it('throws a MakooError when an enabled task has no manifest binding', () => {
		const missingInjection = {
			moduleId: 'missing'
		} as ResolvedInjectionModule;

		let error: unknown;
		try {
			buildManifestBindings({
				manifest: { injections: [] },
				manifestFile: '/project/injections/manifest.ts',
				manifestInjections: [],
				moduleInjections: [],
				manifestListeners: [],
				enabledInjections: [missingInjection],
				enabledListeners: []
			});
		} catch (cause) {
			error = cause;
		}

		expect(error).toBeInstanceOf(MakooError);
		expect(error).toMatchObject({
			code: ErrorCode.CLI_MANIFEST_BINDING_NOT_FOUND,
			name: 'ManifestBindingNotFoundError'
		});
	});
});
