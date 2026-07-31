import { ErrorCode, MakooError } from '@makoojs/core';
import { describe, expect, it } from 'vitest';
import { renderImportManifest } from '../src/generator/render/import/importManifest';
import type { ScannerManifestBindings } from '../src/scanner/types';

describe('renderImportManifest', () => {
	it('deduplicates and sorts manifest imports', () => {
		const bindings: ScannerManifestBindings = {
			injectionDefaults: {
				hooks: {
					manifestFile: '/project/injections/manifest.ts',
					valuePath: ['injectionDefaults', 'hooks']
				}
			},
			injections: {
				panel: {
					hooks: {
						manifestFile: '/project/injections/panel/manifest.ts',
						valuePath: ['hooks']
					}
				},
				header: {
					on: {
						callback: {
							manifestFile: '/project/injections/manifest.ts',
							valuePath: ['injections', 'header', 'on', 'callback']
						}
					}
				},
				withoutRuntimeFunctions: {}
			},
			listeners: {
				close: {
					callback: {
						manifestFile: '/project/injections/manifest.ts',
						valuePath: ['listeners', 'close', 'callback']
					}
				}
			}
		};

		const result = renderImportManifest(bindings);

		expect(result.code).toBe(
			[
				"import Manifest_0 from '/project/injections/manifest.ts';",
				"import Manifest_1 from '/project/injections/panel/manifest.ts';"
			].join('\n')
		);
	});

	it('does not import manifests for injections without runtime functions', () => {
		const result = renderImportManifest({
			injections: {
				panel: {}
			},
			listeners: {}
		});

		expect(result.code).toBe('');
	});

	it('renders references from manifest and field paths', () => {
		const binding = {
			manifestFile: 'C:\\project\\injections\\manifest.ts',
			valuePath: ['listeners', 'close', 'callback']
		};
		const result = renderImportManifest({
			injections: {},
			listeners: { close: { callback: binding } }
		});

		expect(result.code).toBe("import Manifest_0 from 'C:/project/injections/manifest.ts';");
		expect(result.renderReference(binding)).toBe(
			'Manifest_0["listeners"]["close"]["callback"]'
		);
	});

	it('rejects references to manifests outside the import registry', () => {
		const result = renderImportManifest({ injections: {}, listeners: {} });
		const renderMissingReference = () =>
			result.renderReference({
				manifestFile: '/project/injections/manifest.ts',
				valuePath: []
			});

		let error: unknown;
		try {
			renderMissingReference();
		} catch (cause) {
			error = cause;
		}

		expect(error).toBeInstanceOf(MakooError);
		expect(error).toMatchObject({
			code: ErrorCode.CLI_MANIFEST_IMPORT_NOT_FOUND,
			name: 'ManifestImportNotFoundError'
		});
	});
});
