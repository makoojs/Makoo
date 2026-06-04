import { describe, expect, it } from 'vitest';
import { resolveDependencyMode, resolveMakooDependencies } from '../src/template/util';

describe('resolveDependencyMode', () => {
	it('returns local when debug flag is enabled', () => {
		expect(resolveDependencyMode('1')).toBe('local');
		expect(resolveDependencyMode('true')).toBe('local');
	});

	it('returns npm when debug flag is disabled', () => {
		expect(resolveDependencyMode('0')).toBe('npm');
	});
});

describe('resolveMakooDependencies', () => {
	it('returns npm package versions in npm mode', () => {
		const result = resolveMakooDependencies('Vue', 'npm');

		expect(result.dependencies['@makoo/core']).toBe('^0.1.0');
		expect(result.dependencies['@makoo/vue']).toBe('^0.1.0');
		expect(result.devDependencies['@makoo/cli']).toBe('^0.1.0');
	});

	it('returns local file paths in debug mode', () => {
		const result = resolveMakooDependencies('React', 'local');

		expect(result.dependencies['@makoo/core']).toContain('/packages/core');
		expect(result.dependencies['@makoo/react']).toContain('/packages/react');
		expect(result.devDependencies['@makoo/cli']).toContain('/packages/cli');
	});
});
