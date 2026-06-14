import type {
	ResolvedConfig,
	ResolvedInjectionModule,
	ResolvedInjectorConfig
} from '../config/types';
import { scanner } from '../scanner/scanner';
import type { ScannerResult } from '../scanner/types';
import { ansi, colorize } from '../shared/terminalColor';
import { loadMakooConfig } from './_util';

type InspectInjectorFields = Pick<ResolvedInjectionModule, 'alive' | 'scope' | 'timeout'>;
type InspectInjection = Omit<ResolvedInjectionModule, keyof InspectInjectorFields> & {
	injectionDefault: InspectInjectorFields;
	injectorOverrides?: Partial<InspectInjectorFields>;
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
	injector: ScannerResult['injector'];
	injections: InspectInjection[];
	frameworks: ScannerResult['frameworks'];
};
export function formatInspectInjection(
	injection: ResolvedInjectionModule,
	injectorDefault: ResolvedInjectorConfig
): InspectInjection {
	const { alive, scope, timeout, ...rest } = injection;
	const injectionDefault = { alive, scope, timeout };
	const injectorOverrides: Partial<InspectInjectorFields> = {
		...(alive !== injectorDefault.alive ? { alive } : {}),
		...(scope !== injectorDefault.scope ? { scope } : {}),
		...(timeout !== injectorDefault.timeout ? { timeout } : {})
	};

	if (Object.keys(injectorOverrides).length === 0) {
		return {
			...rest,
			injectionDefault
		};
	}

	return {
		...rest,
		injectionDefault,
		injectorOverrides
	};
}

export function formatInspectResult(result: ScannerResult): InspectResult {
	const { config, injector: injectorDefault, injections } = result;
	const moduleManifestFiles = [
		...new Set(
			injections
				.map((injection) => injection.overridePath)
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
		injector: injectorDefault,
		injections: injections.map((injection) =>
			formatInspectInjection(injection, injectorDefault)
		),
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
		['Injector', inspectResult.injector],
		['Injections', inspectResult.injections],
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
