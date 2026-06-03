import type { MakooArtifactApi, ResolvableMountAdapter } from '@makoo/core';
import type { ComponentType, ExoticComponent } from 'react';
import type { Root } from 'react-dom/client';

export type ReactMountProps = {
	makoo: MakooArtifactApi;
};

export type ReactMountArtifact = ComponentType<ReactMountProps> | ExoticComponent<ReactMountProps>;
export type ReactMountRoot = Root;

export type ReactMountAdapter = ResolvableMountAdapter<
	ReactMountArtifact,
	ReactMountRoot,
	undefined
>;
