import type { ResolvedListener } from '../../../config/types';
import type { RenderInitResult } from '../../types';
import { renderInlineValue } from '../util/value';

export function renderRegisterListener(
	instanceName: string,
	listeners: ResolvedListener[]
): RenderInitResult {
	const registerCode = listeners.map((listener) => {
		const declaration = [
			`"id":${JSON.stringify(listener.listenerId)}`,
			`"listenAt":${JSON.stringify(listener.listenAt)}`,
			`"type":${JSON.stringify(listener.type)}`,
			`"callback":${renderInlineValue(listener.callback)}`,
			listener.activitySignal
				? `"activitySignal":${renderInlineValue(listener.activitySignal)}`
				: null
		]
			.filter(Boolean)
			.join(',');
		const register = `${instanceName}Tasks.push(listen({${declaration}}));`;

		if (!listener.match) {
			return register;
		}

		return [
			`if (matchUrl(location.href, ${renderInlineValue(listener.match)})) {`,
			`  ${register}`,
			'}'
		].join('\n');
	});

	return {
		code: registerCode.join('\n'),
		instanceName
	};
}
