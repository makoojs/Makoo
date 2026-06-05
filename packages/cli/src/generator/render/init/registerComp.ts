import type { ArtifactOptions } from '@makoojs/core';
import type { Component, RenderInitResult } from '../../../generator/types';
import { renderInlineValue } from '../util/value';

// runtime inject web url match logic
const renderMatchUrlHelper = (): string => {
	return [
		'const matchUrl = (url, match) => {',
		'  if (!match) return true;',
		'  const matches = (patterns) => {',
		'    if (!patterns) return false;',
		// biome-ignore lint/suspicious/noTemplateCurlyInString: generated code intentionally contains template syntax.
		"    const escape = (value) => value.replace(/[.+?^${}()|[\\]\\\\]/g, '\\\\$&');",
		// biome-ignore lint/suspicious/noTemplateCurlyInString: generated code intentionally contains template syntax.
		"    return patterns.some((pattern) => new RegExp(`^${pattern.split('*').map(escape).join('.*')}$`).test(url));",
		'  };',
		'  const included = match.include ? matches(match.include) : true;',
		'  if (!included) return false;',
		'  if (match.exclude && matches(match.exclude)) return false;',
		'  return true;',
		'};'
	].join('\n');
};

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
		const register = `${instanceName}.register(${JSON.stringify(item.componentMeta.injectAt)}, ${item.componentName}, ${renderInlineValue(config)});`;

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
