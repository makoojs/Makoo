import { ManifestBindingNotFoundError } from '../../../error/MakooCliError';
import type { InjectionManifestBindings, ScannerManifestBindings } from '../../../scanner/types';
import type { Component, RenderInitResult, RenderManifestReference } from '../../types';
import { renderInlineValue } from '../util/value';

export function renderRegisterComponent(
	instanceName: string,
	components: Component[],
	manifestBindings: ScannerManifestBindings['injections'],
	renderManifestReference: RenderManifestReference
): RenderInitResult {
	const registerCode = components.map((item) => {
		const manifestBinding = manifestBindings[item.componentMeta.moduleId];
		const options = renderArtifactOptions(item, manifestBinding, renderManifestReference);
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
	item: Component,
	manifestBinding: InjectionManifestBindings | undefined,
	renderManifestReference: RenderManifestReference
): string {
	const { componentMeta } = item;
	const config = {
		alive: componentMeta.alive,
		scope: componentMeta.scope,
		timeout: componentMeta.timeout
	};
	const entries = Object.entries(config)
		.filter(([, value]) => typeof value !== 'undefined')
		.map(([key, value]) => `${JSON.stringify(key)}:${renderInlineValue(value)}`);

	if (componentMeta.hooks) {
		if (!manifestBinding?.hooks) {
			throw new ManifestBindingNotFoundError('injection', `${componentMeta.moduleId}.hooks`);
		}
		entries.push(`"hooks":${renderManifestReference(manifestBinding.hooks)}`);
	}

	if (componentMeta.on) {
		if (!manifestBinding?.on) {
			throw new ManifestBindingNotFoundError('injection', `${componentMeta.moduleId}.on`);
		}
		const listenDeclaration = [
			`"listenAt":${JSON.stringify(componentMeta.on.listenAt)}`,
			`"type":${JSON.stringify(componentMeta.on.type)}`,
			`"callback":${renderManifestReference(manifestBinding.on.callback)}`,
			componentMeta.on.activitySignal
				? renderActivitySignal(
						componentMeta.moduleId,
						manifestBinding,
						renderManifestReference
					)
				: null
		]
			.filter(Boolean)
			.join(',');
		entries.push(`"on":listen({${listenDeclaration}})`);
	}

	return `{${entries.join(',')}}`;
}

function renderActivitySignal(
	moduleId: string,
	manifestBinding: InjectionManifestBindings,
	renderManifestReference: RenderManifestReference
): string {
	const activitySignalBinding = manifestBinding.on?.activitySignal;
	if (!activitySignalBinding) {
		throw new ManifestBindingNotFoundError('injection', `${moduleId}.on.activitySignal`);
	}
	return `"activitySignal":${renderManifestReference(activitySignalBinding)}`;
}
