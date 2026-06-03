import type { ExoticComponent } from 'react';
import type { ReactMountArtifact, ReactMountProps } from './types';

export function isReactMountArtifact(artifact: unknown): artifact is ReactMountArtifact {
	return typeof artifact === 'function' || isReactExoticComponent(artifact);
}

function isReactExoticComponent(artifact: unknown): artifact is ExoticComponent<ReactMountProps> {
	if (typeof artifact !== 'object' || artifact === null) {
		return false;
	}

	const maybe = artifact as Record<PropertyKey, unknown>;

	return typeof maybe.$$typeof === 'symbol';
}
