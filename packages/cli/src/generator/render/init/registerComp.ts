import type { Component, RenderInitResult } from '../../../generator/types';
import { renderInlineValue } from '../util/value';

export function renderRegisterComponent(
	instanceName: string,
	components: Component[]
): RenderInitResult {
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
		code: registerCode.join('\n'),
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
		const listenDeclaration = [
			`"listenAt":${JSON.stringify(on.listenAt)}`,
			`"type":${JSON.stringify(on.type)}`,
			`"callback":${renderInlineValue(on.callback)}`,
			on.activitySignal ? `"activitySignal":${renderInlineValue(on.activitySignal)}` : null
		]
			.filter(Boolean)
			.join(',');
		entries.push(`"on":listen({${listenDeclaration}})`);
	}

	return `{${entries.join(',')}}`;
}
