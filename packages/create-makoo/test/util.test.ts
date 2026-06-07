import { describe, expect, it } from 'vitest';
import { recommendedMakooVersions } from '../src/template/makooVersion';
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
	it('tracks every Makoo package version in the recommendation table', () => {
		expect(Object.keys(recommendedMakooVersions).sort()).toEqual([
			'cli',
			'core',
			'create-makoo',
			'react',
			'vue'
		]);
	});

	it('returns recommended package versions in npm mode', () => {
		const result = resolveMakooDependencies('Vue', 'npm');

		expect(result.dependencies['@makoojs/core']).toBe(recommendedMakooVersions.core);
		expect(result.dependencies['@makoojs/vue']).toBe(recommendedMakooVersions.vue);
		expect(result.devDependencies['@makoojs/cli']).toBe(recommendedMakooVersions.cli);
	});

	it('returns local file paths in debug mode', () => {
		const result = resolveMakooDependencies('React', 'local');

		expect(result.dependencies['@makoojs/core']).toContain('/packages/core');
		expect(result.dependencies['@makoojs/react']).toContain('/packages/react');
		expect(result.devDependencies['@makoojs/cli']).toContain('/packages/cli');
	});
});
