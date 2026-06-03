import type { ArtifactOptions } from '@makoo/core';
import type { ResolvedInjectionFramework } from '../../../config/types';
import { UnsupportedFrameworkGenerationError } from '../../../error/error';
import type { Component, RenderInitResult } from '../../../generator/types';
import { renderInlineValue } from '../util/value';

// runtime inject web url match logic
const renderMatchUrlHelper = (): string => {
	return [
		'const matchUrl = (url, match) => {',
		'  if (!match) return true;',
		'  const matches = (patterns) => {',
		'    if (!patterns) return false;',
		"    const escape = (value) => value.replace(/[.+?^${}()|[\\]\\\\]/g, '\\\\$&');",
		"    return patterns.some((pattern) => new RegExp(`^${pattern.split('*').map(escape).join('.*')}$`).test(url));",
		'  };',
		'  const included = match.include ? matches(match.include) : true;',
		'  if (!included) return false;',
		'  if (match.exclude && matches(match.exclude)) return false;',
		'  return true;',
		'};'
	].join('\n');
};
function frameworkVariantRegisterCode(
	instanceName: string,
	component: Component,
	config: ArtifactOptions,
	framework: ResolvedInjectionFramework
): string {
	if (framework === 'Vue') {
		return `${instanceName}.register(${JSON.stringify(component.componentMeta.injectAt)}, ${component.componentName}, ${renderInlineValue(config)});`;
	}

	if (framework === 'React') {
		return `${instanceName}.register(${JSON.stringify(component.componentMeta.injectAt)}, createElement(${component.componentName}), ${renderInlineValue(config)});`;
	}

	throw new UnsupportedFrameworkGenerationError(framework);
}

export function renderRegisterComponent(
	instanceName: string,
	components: Component[]
): RenderInitResult {
	const useMatchHelper = components.some((item) => item.componentMeta.match);
	const registerCode = components.map((item) => {
		const config: ArtifactOptions = {
			alive: item.componentMeta.alive,
			scope: item.componentMeta.scope,
			timeout: item.componentMeta.timeout,
			on: item.componentMeta.on,
			hooks: item.componentMeta.hooks
		};
		const register = frameworkVariantRegisterCode(
			instanceName,
			item,
			config,
			item.componentMeta.framework
		);

		if (!item.componentMeta.match) {
			return register;
		}

		return [
			`if (matchUrl(location.href, ${renderInlineValue(item.componentMeta.match)})) {`,
			`  ${register}`,
			'}'
		].join('\n');
	});

	return {
		code: [useMatchHelper ? renderMatchUrlHelper() : null, registerCode.join('\n')]
			.filter(Boolean)
			.join('\n'),
		instanceName
	};
}
