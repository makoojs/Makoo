import { ManifestImportNotFoundError } from '../../../error/MakooCliError';
import type { ManifestBinding, ScannerManifestBindings } from '../../../scanner/types';
import type { RenderImportManifestResult } from '../../types';

const normalizeImportPath = (value: string): string => value.replace(/\\/g, '/');

const collectManifestFiles = (bindings: ScannerManifestBindings): string[] => {
	const manifestFiles = collectManifestBindings(bindings).map((binding) => binding.manifestFile);

	return [...new Set(manifestFiles.map(normalizeImportPath))].sort();
};

const collectManifestBindings = (bindings: ScannerManifestBindings): ManifestBinding[] => [
	...(bindings.injectionDefaults ? [bindings.injectionDefaults.hooks] : []),
	...Object.values(bindings.injections).flatMap((binding) =>
		[binding.hooks, binding.on?.callback, binding.on?.activitySignal].filter(
			(value): value is ManifestBinding => Boolean(value)
		)
	),
	...Object.values(bindings.listeners).flatMap((binding) =>
		[binding.callback, binding.activitySignal].filter((value): value is ManifestBinding =>
			Boolean(value)
		)
	)
];

const renderValuePath = (valuePath: ManifestBinding['valuePath']): string =>
	valuePath.map((segment) => `[${JSON.stringify(segment)}]`).join('');

export function renderImportManifest(
	bindings: ScannerManifestBindings
): RenderImportManifestResult {
	const manifestImports = new Map(
		collectManifestFiles(bindings).map((manifestFile, index) => [
			manifestFile,
			`Manifest_${index}`
		])
	);

	return {
		code: [...manifestImports]
			.map(([manifestFile, importName]) => `import ${importName} from '${manifestFile}';`)
			.join('\n'),

		// render the property access code
		renderReference(binding) {
			// get the generated Manifest_{index} name
			const importName = manifestImports.get(normalizeImportPath(binding.manifestFile));
			if (!importName) {
				throw new ManifestImportNotFoundError(binding.manifestFile);
			}

			return `${importName}${renderValuePath(binding.valuePath)}`;
		}
	};
}
