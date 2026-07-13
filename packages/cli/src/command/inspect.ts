import type {
	ResolvedConfig,
	ResolvedInjectionDefaults,
	ResolvedInjectionModule,
	ResolvedListener
} from '../config/types';
import { scanner } from '../scanner/scanner';
import type { ScannerResult } from '../scanner/types';
import { ansi, colorize } from '../shared/terminalColor';
import { loadMakooConfig } from './_util';

type InspectInjectionDefaultsFields = Pick<ResolvedInjectionModule, 'alive' | 'scope' | 'timeout'>;
type InspectInjection = Omit<ResolvedInjectionModule, keyof InspectInjectionDefaultsFields> & {
	injectionDefaults: InspectInjectionDefaultsFields;
	injectionDefaultsOverrides?: Partial<InspectInjectionDefaultsFields>;
};
type InspectResult = {
	project: {
		root: ResolvedConfig['root'];
		app: ResolvedConfig['app'];
	};
	source: {
		config: ResolvedConfig['source'];
		manifestFile: ScannerResult['manifestFile'];
		moduleManifestFiles: string[];
		dependencies: {
			manifest: ScannerResult['manifestDependencies'];
			moduleManifests: ScannerResult['moduleManifestDependencies'];
		};
	};
	runtime: {
		setupFiles: ScannerResult['runtimeSetupFiles'];
		dependencies: ScannerResult['runtimeDependencies'];
	};
	monkey: ResolvedConfig['monkey'];
	injectionDefaults: ScannerResult['injectionDefaults'];
	injections: InspectInjection[];
	listeners: ResolvedListener[];
	frameworks: ScannerResult['frameworks'];
};
export function formatInspectInjection(
	injection: ResolvedInjectionModule,
	injectionDefaults: ResolvedInjectionDefaults
): InspectInjection {
	const { alive, scope, timeout, ...rest } = injection;
	const resolvedInjectionDefaults = { alive, scope, timeout };
	const injectionDefaultsOverrides: Partial<InspectInjectionDefaultsFields> = {
		...(alive !== injectionDefaults.alive ? { alive } : {}),
		...(scope !== injectionDefaults.scope ? { scope } : {}),
		...(timeout !== injectionDefaults.timeout ? { timeout } : {})
	};

	if (Object.keys(injectionDefaultsOverrides).length === 0) {
		return {
			...rest,
			injectionDefaults: resolvedInjectionDefaults
		};
	}

	return {
		...rest,
		injectionDefaults: resolvedInjectionDefaults,
		injectionDefaultsOverrides
	};
}

export function formatInspectResult(result: ScannerResult): InspectResult {
	const { config, injectionDefaults, injections, listeners } = result;
	const moduleManifestFiles = [
		...new Set(
			injections
				.map((injection) => injection.moduleManifestFile)
				.filter((file): file is string => typeof file === 'string')
		)
	].sort();

	return {
		project: {
			root: config.root,
			app: config.app
		},
		source: {
			config: config.source,
			manifestFile: result.manifestFile,
			moduleManifestFiles,
			dependencies: {
				manifest: result.manifestDependencies,
				moduleManifests: result.moduleManifestDependencies
			}
		},
		runtime: {
			setupFiles: result.runtimeSetupFiles,
			dependencies: result.runtimeDependencies
		},
		monkey: config.monkey,
		injectionDefaults,
		injections: injections.map((injection) =>
			formatInspectInjection(injection, injectionDefaults)
		),
		listeners,
		frameworks: result.frameworks
	};
}

export async function inspectCommand() {
	const resolveViteMakooConfig: ResolvedConfig = await loadMakooConfig();
	const resolveManifest: ScannerResult = await scanner(resolveViteMakooConfig);
	const inspectResult = formatInspectResult(resolveManifest);
	const sections: Array<[string, unknown]> = [
		['Project', inspectResult.project],
		['Source', inspectResult.source],
		['Runtime', inspectResult.runtime],
		['Monkey', inspectResult.monkey],
		['Injection Defaults', inspectResult.injectionDefaults],
		['Injections', inspectResult.injections],
		['Listeners', inspectResult.listeners],
		['Frameworks', inspectResult.frameworks]
	];

	console.log(colorize('Makoo Inspect', ansi.bold, ansi.green));
	for (const [label, value] of sections) {
		console.log(`\n${colorize(label, ansi.cyan)}`);
		console.dir(value, {
			depth: null,
			colors: true
		});
	}
}
