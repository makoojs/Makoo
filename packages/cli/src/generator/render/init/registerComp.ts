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
		const config = {
			alive: item.componentMeta.alive,
			scope: item.componentMeta.scope,
			timeout: item.componentMeta.timeout,
			hooks: item.componentMeta.hooks
		};
		const options = renderArtifactOptions(config, item.componentMeta.on);
		const declaration = [
			`"id":${JSON.stringify(item.componentMeta.moduleId)}`,
			`"injectAt":${JSON.stringify(item.componentMeta.injectAt)}`,
			`"artifact":${item.componentName}`,
			`"options":${options}`
		].join(',');
		const register = `${instanceName}Tasks.push(inject({${declaration}}));`;

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

function renderArtifactOptions(
	config: Record<string, unknown>,
	on?: Component['componentMeta']['on']
): string {
	const entries = Object.entries(config)
		.filter(([, value]) => typeof value !== 'undefined')
		.map(([key, value]) => `${JSON.stringify(key)}:${renderInlineValue(value)}`);

	if (on) {
		const listenOptions = on.activitySignal
			? `, { "activitySignal":${renderInlineValue(on.activitySignal)} }`
			: '';
		entries.push(
			`"on":listen(${JSON.stringify(on.listenAt)}, ${JSON.stringify(on.type)}, ${renderInlineValue(on.callback)}${listenOptions})`
		);
	}

	return `{${entries.join(',')}}`;
}
