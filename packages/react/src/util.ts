import { isValidElement } from 'react';
import type { ReactMountArtifact } from './types';

export function isReactElement(artifact: unknown): artifact is ReactMountArtifact {
	return isValidElement(artifact);
}
