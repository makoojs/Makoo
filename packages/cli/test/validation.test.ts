import { MakooError } from '@makoojs/core';
import { describe, expect, it } from 'vitest';
import {
	ManifestValidationError,
	UnsupportedSelectorTargetError
} from '../src/error/MakooCliError';
import {
	InjectionDefaultsSchema,
	InjectionListenerSchema,
	InjectionManifestSchema,
	InjectionMatchSchema,
	InjectionModuleListenerSchema,
	InjectionModuleSchema,
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
			'start:requested': [() => {}, () => {}]
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

describe('InjectionDefaultsSchema', () => {
	it('accepts valid injection defaults with hooks', () => {
		const result = InjectionDefaultsSchema.safeParse({
			alive: true,
			scope: 'global',
			timeout: 3000,
			hooks: {
				'register:start': () => {}
			}
		});
		expect(result.success).toBe(true);
	});

	it('accepts empty injection defaults', () => {
		expect(InjectionDefaultsSchema.safeParse({}).success).toBe(true);
	});

	it('rejects invalid scope', () => {
		expect(InjectionDefaultsSchema.safeParse({ scope: 'invalid' }).success).toBe(false);
	});
});

describe('InjectionModuleSchema', () => {
	it('accepts match as include array shorthand', () => {
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app',
			component: './index.tsx',
			match: ['https://example.com/*']
		});
		expect(result.success).toBe(true);
	});

	it('accepts match as include/exclude object', () => {
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app',
			component: './index.tsx',
			match: {
				include: ['https://example.com/*'],
				exclude: ['https://example.com/admin/*']
			}
		});
		expect(result.success).toBe(true);
	});

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

	it('accepts module listener config', () => {
		const callback = () => undefined;
		const activitySignal = () => ({ value: true });
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app',
			component: './index.tsx',
			on: {
				listenAt: '#open',
				type: 'click',
				callback,
				activitySignal
			}
		});
		expect(result.success).toBe(true);
	});

	it('accepts module lifecycle hooks', () => {
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app',
			component: './index.tsx',
			hooks: {
				'artifact:mountSuccess': () => undefined
			}
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

	it('rejects invalid match config', () => {
		const result = InjectionModuleSchema.safeParse({
			injectAt: '#app',
			component: './test.tsx',
			match: 123
		});
		expect(result.success).toBe(false);
	});
});

describe('InjectionModuleListenerSchema', () => {
	it('accepts listener options used by injection on', () => {
		const callback = () => undefined;
		const activitySignal = () => ({ value: true });
		const result = InjectionModuleListenerSchema.safeParse({
			listenAt: '#button',
			type: 'click',
			callback,
			capture: true,
			activitySignal
		});
		expect(result.success).toBe(true);
	});

	it('accepts false capture and rejects non-boolean capture values', () => {
		expect(
			InjectionModuleListenerSchema.safeParse({
				listenAt: '#button',
				type: 'click',
				callback: () => undefined,
				capture: false
			}).success
		).toBe(true);
		expect(
			InjectionModuleListenerSchema.safeParse({
				listenAt: '#button',
				type: 'click',
				callback: () => undefined,
				capture: 'true'
			}).success
		).toBe(false);
	});

	it('rejects missing callback', () => {
		const result = InjectionModuleListenerSchema.safeParse({
			listenAt: '#button',
			type: 'click'
		});
		expect(result.success).toBe(false);
	});
});

describe('InjectionListenerSchema', () => {
	it('accepts top-level listener config with match and enabled', () => {
		const result = InjectionListenerSchema.safeParse({
			name: 'escape-close',
			listenAt: 'body',
			type: 'keydown',
			callback: () => undefined,
			capture: true,
			activitySignal: () => ({ value: true }),
			match: ['https://example.com/*'],
			enabled: true
		});
		expect(result.success).toBe(true);
	});

	it('rejects missing listenAt', () => {
		const result = InjectionListenerSchema.safeParse({
			type: 'keydown',
			callback: () => undefined
		});
		expect(result.success).toBe(false);
	});
});

describe('InjectionMatchSchema', () => {
	it('accepts array and object forms', () => {
		expect(InjectionMatchSchema.safeParse(['https://example.com/*']).success).toBe(true);
		expect(
			InjectionMatchSchema.safeParse({
				include: ['https://example.com/*'],
				exclude: ['https://example.com/admin/*']
			}).success
		).toBe(true);
	});

	it('rejects non-string patterns', () => {
		expect(InjectionMatchSchema.safeParse([123]).success).toBe(false);
		expect(
			InjectionMatchSchema.safeParse({
				include: [true]
			}).success
		).toBe(false);
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

	it('accepts manifest with injectionDefaults', () => {
		const result = InjectionManifestSchema.safeParse({
			injectionDefaults: { alive: true, scope: 'global', timeout: 3000 },
			injections: [{ name: 'a', injectAt: '#a', component: './a.tsx' }]
		});
		expect(result.success).toBe(true);
	});

	it('accepts manifest with only listeners', () => {
		const result = InjectionManifestSchema.safeParse({
			listeners: {
				escapeClose: {
					listenAt: 'body',
					type: 'keydown',
					callback: () => undefined
				}
			}
		});
		expect(result.success).toBe(true);
	});

	it('accepts array form listeners', () => {
		const result = InjectionManifestSchema.safeParse({
			listeners: [
				{
					name: 'escapeClose',
					listenAt: 'body',
					type: 'keydown',
					callback: () => undefined
				}
			]
		});
		expect(result.success).toBe(true);
	});

	it('rejects manifest with old globalInjector field', () => {
		const result = InjectionManifestSchema.safeParse({
			globalInjector: { alive: true, scope: 'global', timeout: 3000 },
			injections: [{ name: 'a', injectAt: '#a', component: './a.tsx' }]
		});
		expect(result.success).toBe(false);
	});

	it('rejects manifest without injections or listeners', () => {
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

	it('rejects listener item missing listenAt', () => {
		const result = InjectionManifestSchema.safeParse({
			listeners: [{ name: 'bad', type: 'click', callback: () => undefined }]
		});
		expect(result.success).toBe(false);
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

	it.each(['document', 'window'])('rejects the global listener target %s', (listenAt) => {
		expect(() =>
			validateManifest(
				{
					listeners: {
						escapeClose: {
							listenAt,
							type: 'keydown',
							callback: () => undefined
						}
					}
				},
				'/project/injections/manifest.ts'
			)
		).toThrow(UnsupportedSelectorTargetError);
	});

	it.each(['document', 'window'])('rejects the injection target %s', (injectAt) => {
		try {
			validateManifest(
				{
					injections: {
						panel: {
							injectAt,
							component: './panel.tsx'
						}
					}
				},
				'/project/injections/manifest.ts'
			);
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(UnsupportedSelectorTargetError);
			expect((err as UnsupportedSelectorTargetError).issues).toEqual([
				{
					path: 'injections.panel.injectAt',
					message: 'must be a CSS selector; document and window are not supported'
				}
			]);
		}
	});

	it('reports the injection listener path for an unsupported target', () => {
		try {
			validateManifest(
				{
					injections: {
						panel: {
							injectAt: '#app',
							component: './panel.tsx',
							on: {
								listenAt: 'window',
								type: 'resize',
								callback: () => undefined
							}
						}
					}
				},
				'/project/injections/manifest.ts'
			);
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(UnsupportedSelectorTargetError);
			expect((err as UnsupportedSelectorTargetError).issues).toEqual([
				{
					path: 'injections.panel.on.listenAt',
					message: 'must be a CSS selector; document and window are not supported'
				}
			]);
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

	it.each(['document', 'window'])('rejects the module injection target %s', (injectAt) => {
		expect(() =>
			validateModuleMeta(
				{
					injectAt,
					component: './index.tsx'
				},
				'/project/injections/widget/manifest.ts'
			)
		).toThrow(UnsupportedSelectorTargetError);
	});

	it('rejects document as a module listener target', () => {
		expect(() =>
			validateModuleMeta(
				{
					injectAt: '#app',
					component: './index.tsx',
					on: {
						listenAt: 'document',
						type: 'keydown',
						callback: () => undefined
					}
				},
				'/project/injections/widget/manifest.ts'
			)
		).toThrow(UnsupportedSelectorTargetError);
	});
});
