import { describe, expect, it } from 'vitest';
import {
	InjectionManifestSchema,
	InjectionModuleSchema,
	InjectorConfigSchema,
	LifecycleHookMapSchema,
	ManifestValidationError,
	ObserveEventNameSchema,
	validateManifest,
	validateModuleMeta
} from '../src/scanner/validation';

describe('ObserveEventNameSchema', () => {
	it('accepts valid event names', () => {
		expect(ObserveEventNameSchema.safeParse('register:start').success).toBe(true);
		expect(ObserveEventNameSchema.safeParse('artifact:mountSuccess').success).toBe(true);
		expect(ObserveEventNameSchema.safeParse('dom:targetRestored').success).toBe(true);
	});

	it('rejects invalid event names', () => {
		expect(ObserveEventNameSchema.safeParse('invalid:event').success).toBe(false);
		expect(ObserveEventNameSchema.safeParse('').success).toBe(false);
	});
});

describe('LifecycleHookMapSchema', () => {
	it('accepts valid hook map with function values', () => {
		const result = LifecycleHookMapSchema.safeParse({
			'register:start': () => {},
			'run:start': [() => {}, () => {}]
		});
		expect(result.success).toBe(true);
	});

	it('accepts empty object', () => {
		expect(LifecycleHookMapSchema.safeParse({}).success).toBe(true);
	});

	it('rejects non-function values', () => {
		const result = LifecycleHookMapSchema.safeParse({
			'register:start': 'not a function'
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid event names', () => {
		const result = LifecycleHookMapSchema.safeParse({
			'invalid:event': () => {}
		});
		expect(result.success).toBe(false);
	});
});

describe('InjectorConfigSchema', () => {
	it('accepts valid injector config with hooks', () => {
		const result = InjectorConfigSchema.safeParse({
			alive: true,
			scope: 'global',
			timeout: 3000,
			hooks: {
				'register:start': () => {}
			}
		});
		expect(result.success).toBe(true);
	});

	it('accepts empty injector config', () => {
		expect(InjectorConfigSchema.safeParse({}).success).toBe(true);
	});

	it('rejects invalid scope', () => {
		expect(InjectorConfigSchema.safeParse({ scope: 'invalid' }).success).toBe(false);
	});
});

describe('InjectionModuleSchema', () => {
	it('accepts valid module config', () => {
		const result = InjectionModuleSchema.safeParse({
			name: 'widget',
			injectAt: '#app',
			component: './index.tsx',
			framework: 'React',
			enabled: true,
			alive: false,
			scope: 'local',
			timeout: 5000
		});
		expect(result.success).toBe(true);
	});

	it('accepts minimal config with only injectAt and component', () => {
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app',
			component: './App.vue'
		});
		expect(result.success).toBe(true);
	});

	it('rejects missing injectAt', () => {
		const result = InjectionModuleSchema.safeParse({
			name: 'widget',
			component: './widget.tsx'
		});
		expect(result.success).toBe(false);
	});

	it('rejects missing component', () => {
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app'
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid framework', () => {
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app',
			component: './test.tsx',
			framework: 'Angular'
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid scope', () => {
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app',
			component: './test.tsx',
			scope: 'remote'
		});
		expect(result.success).toBe(false);
	});
});

describe('InjectionManifestSchema', () => {
	it('accepts array form injections', () => {
		const result = InjectionManifestSchema.safeParse({
			injections: [
				{ name: 'a', injectAt: '#a', component: './a.tsx', framework: 'React' },
				{ name: 'b', injectAt: '#b', component: './b.vue', framework: 'Vue' }
			]
		});
		expect(result.success).toBe(true);
	});

	it('accepts record form injections', () => {
		const result = InjectionManifestSchema.safeParse({
			injections: {
				widget: { injectAt: '#app', component: './widget.tsx', framework: 'React' },
				panel: { injectAt: '#panel', component: './panel.vue', framework: 'Vue' }
			}
		});
		expect(result.success).toBe(true);
	});

	it('accepts manifest with globalInjector', () => {
		const result = InjectionManifestSchema.safeParse({
			globalInjector: { alive: true, scope: 'global', timeout: 3000 },
			injections: [{ name: 'a', injectAt: '#a', component: './a.tsx' }]
		});
		expect(result.success).toBe(true);
	});

	it('rejects missing injections', () => {
		const result = InjectionManifestSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects injections that is neither array nor record', () => {
		const result = InjectionManifestSchema.safeParse({
			injections: 'not-valid'
		});
		expect(result.success).toBe(false);
	});

	it('rejects array item missing injectAt', () => {
		const result = InjectionManifestSchema.safeParse({
			injections: [{ name: 'bad', component: './bad.tsx' }]
		});
		expect(result.success).toBe(false);
	});
});

describe('validateManifest', () => {
	it('returns parsed data on success', () => {
		const data = validateManifest(
			{ injections: [{ name: 'a', injectAt: '#a', component: './a.tsx' }] },
			'/project/injections/manifest.ts'
		);
		expect(data.injections).toBeInstanceOf(Array);
	});

	it('throws ManifestValidationError with file path on failure', () => {
		expect(() =>
			validateManifest({}, '/project/injections/manifest.ts')
		).toThrow(ManifestValidationError);

		try {
			validateManifest({}, '/project/injections/manifest.ts');
		} catch (err) {
			expect(err).toBeInstanceOf(ManifestValidationError);
			const e = err as ManifestValidationError;
			expect(e.file).toBe('/project/injections/manifest.ts');
			expect(e.message).toContain('Invalid manifest');
			expect(e.message).toContain('/project/injections/manifest.ts');
		}
	});
});

describe('validateModuleMeta', () => {
	it('returns parsed data on success', () => {
		const data = validateModuleMeta(
			{ injectAt: '#app', component: './index.tsx', framework: 'React' },
			'/project/injections/widget/manifest.ts'
		);
		expect(data.injectAt).toBe('#app');
	});

	it('throws ManifestValidationError with file path on failure', () => {
		expect(() =>
			validateModuleMeta({}, '/project/injections/widget/manifest.ts')
		).toThrow(ManifestValidationError);

		try {
			validateModuleMeta({}, '/project/injections/widget/manifest.ts');
		} catch (err) {
			expect(err).toBeInstanceOf(ManifestValidationError);
			const e = err as ManifestValidationError;
			expect(e.file).toBe('/project/injections/widget/manifest.ts');
			expect(e.message).toContain('Invalid manifest');
		}
	});
});
