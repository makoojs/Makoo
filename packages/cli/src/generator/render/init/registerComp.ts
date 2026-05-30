import type { ArtifactOptions } from '@makoo/core';
import type { Component, RenderInitResult } from '../../../generator/type';
import { renderInlineValue } from '../util/value';

export function renderRegisterComponent(
	instanceName: string,
	components: Component[]
): RenderInitResult {
	const registerCode = components.map((item) => {
		const config: ArtifactOptions = {
			alive: item.componentMeta.alive,
			scope: item.componentMeta.scope,
			timeout: item.componentMeta.timeout,
			on: item.componentMeta.on,
			hooks: item.componentMeta.hooks
		};
		return `${instanceName}.register(${JSON.stringify(item.componentMeta.injectAt)}, ${item.componentName}, ${renderInlineValue(config)});`;
	});

	return {
		code: registerCode.join('\n'),
		instanceName
	};
}
