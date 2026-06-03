import type { ResolvableMountAdapter } from '@makoo/core';
import type { ReactElement } from 'react';
import type { Root } from 'react-dom/client';

export type ReactMountArtifact = ReactElement;
export type ReactMountRoot = Root;

export type ReactMountAdapter = ResolvableMountAdapter<
	ReactMountArtifact,
	ReactMountRoot,
	undefined
>;
