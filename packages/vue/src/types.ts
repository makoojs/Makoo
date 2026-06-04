import type { MakooContext, ResolvableMountAdapter } from '@makoo/core';
import type { App, Component, ComponentPublicInstance } from 'vue';

export type VueMountHandle = App<Element>;
export type VueMountArtifact = Component;
export type VueMountInstance = ComponentPublicInstance;
export type VueMountProps = {
	makoo: MakooContext;
};

export type VueMountAdapter = ResolvableMountAdapter<
	VueMountArtifact,
	VueMountHandle,
	VueMountInstance
>;

export type VueComponent = {
	setup?: () => void;
	render?: () => void;
	template?: string;
	__vccOpts?: unknown;
	__asyncLoader?: unknown;
};
