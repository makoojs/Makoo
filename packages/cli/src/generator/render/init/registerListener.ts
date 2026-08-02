import type { ResolvedListener } from '../../../config/types';
import { ManifestBindingNotFoundError } from '../../../error/MakooCliError';
import type { ManifestBinding, ScannerManifestBindings } from '../../../scanner/types';
import type { RenderInitResult, RenderManifestReference } from '../../types';
import { renderInlineValue } from '../util/value';

export function renderRegisterListener(
	instanceName: string,
	listeners: ResolvedListener[],
	manifestBindings: ScannerManifestBindings['listeners'],
	renderManifestReference: RenderManifestReference
): RenderInitResult {
	const registerCode = listeners.map((listener) => {
		const manifestBinding = manifestBindings[listener.listenerId];
		if (!manifestBinding) {
			throw new ManifestBindingNotFoundError('listener', listener.listenerId);
		}
		const declaration = [
			`"id":${JSON.stringify(listener.listenerId)}`,
			`"listenAt":${JSON.stringify(listener.listenAt)}`,
			`"type":${JSON.stringify(listener.type)}`,
			`"callback":${renderManifestReference(manifestBinding.callback)}`,
			typeof listener.capture !== 'undefined'
				? `"capture":${JSON.stringify(listener.capture)}`
				: null,
			listener.activitySignal
				? renderActivitySignal(
						listener.listenerId,
						manifestBinding.activitySignal,
						renderManifestReference
					)
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

function renderActivitySignal(
	listenerId: string,
	manifestBinding: ManifestBinding | undefined,
	renderManifestReference: RenderManifestReference
): string {
	if (!manifestBinding) {
		throw new ManifestBindingNotFoundError('listener', `${listenerId}.activitySignal`);
	}
	return `"activitySignal":${renderManifestReference(manifestBinding)}`;
}
