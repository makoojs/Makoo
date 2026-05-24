import { describe, expect, it } from 'vitest';
import { ManifestValidationError, MakooError } from '../src/scanner/error';
import {
	InjectionManifestSchema,
	InjectionModuleSchema,
	InjectorConfigSchema,
	LifecycleHookMapSchema,
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

describe('MakooError', () => {
	it('formats message with issues', () => {
		const err = new MakooError('Something went wrong', [
			{ path: 'foo.bar', message: 'is required' },
			{ path: 'baz', message: 'must be one of "a", "b"' }
		]);
		expect(err.message).toContain('[makoo] Something went wrong');
		expect(err.message).toContain('- foo.bar: is required');
		expect(err.message).toContain('- baz: must be one of "a", "b"');
		expect(err).toBeInstanceOf(Error);
	});

	it('formats message without issues', () => {
		const err = new MakooError('Something went wrong');
		expect(err.message).toBe('[makoo] Something went wrong');
	});

	it('exposes issues for programmatic access', () => {
		const issues = [{ path: 'x', message: 'bad' }];
		const err = new MakooError('msg', issues);
		expect(err.issues).toBe(issues);
	});
});

describe('ManifestValidationError', () => {
	it('extends MakooError', () => {
		const err = new ManifestValidationError('/project/injections/manifest.ts', []);
		expect(err).toBeInstanceOf(MakooError);
		expect(err).toBeInstanceOf(ManifestValidationError);
	});

	it('formats human-readable message from Zod issues', () => {
		const result = InjectionModuleSchema.safeParse({});
		expect(result.success).toBe(false);
		if (!result.success) {
			const err = new ManifestValidationError(
				'/project/injections/widget/manifest.ts',
				result.error.issues
			);
			expect(err.message).toContain('[makoo] Invalid manifest at');
			expect(err.message).toContain('injectAt: is required');
			expect(err.message).toContain('component: is required');
		}
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

	it('throws ManifestValidationError with formatted message on failure', () => {
		try {
			validateManifest({}, '/project/injections/manifest.ts');
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(ManifestValidationError);
			const e = err as ManifestValidationError;
			expect(e.message).toContain('[makoo] Invalid manifest at');
			expect(e.message).toContain('injections');
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

	it('throws ManifestValidationError with formatted message on failure', () => {
		try {
			validateModuleMeta({}, '/project/injections/widget/manifest.ts');
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(ManifestValidationError);
			const e = err as ManifestValidationError;
			expect(e.message).toContain('[makoo] Invalid manifest at');
			expect(e.message).toContain('injectAt: is required');
		}
	});
});
