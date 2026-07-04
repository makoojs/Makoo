import type { MakooRuntimeState } from '../runtime/types';
import type { ArtifactTask, Task, TaskListenerFeature } from './types';

const inferredArtifactIds = new WeakMap<object, string>();
let inferredArtifactIdCount = 0;

export function isArtifactTask(task: Task): task is ArtifactTask {
	return task.kind === 'component';
}

export function getTaskInjectAt(task: Task): string {
	return isArtifactTask(task) ? task.injectAt : task.listenAt;
}

export function getTaskListener(task: Task): TaskListenerFeature | undefined {
	if (!task.withEvent) {
		return undefined;
	}

	const listener = isArtifactTask(task) ? task.listener : task;
	if (!listener?.listenAt || !listener.event || !listener.callback) {
		return undefined;
	}

	return listener;
}

export function resolveInjectionTaskId(
	runtime: MakooRuntimeState,
	input: {
		id?: string;
		artifactName: string;
		injectAt: string;
		artifact: unknown;
	}
): string {
	if (input.id) {
		return input.id;
	}

	const baseTaskId = input.artifactName
		? `${input.artifactName}@${input.injectAt}`
		: `artifact-${input.injectAt}`;
	const existingBaseTask = runtime.taskContext.get(baseTaskId);
	if (!existingBaseTask) {
		return baseTaskId;
	}
	if (isArtifactTask(existingBaseTask) && existingBaseTask.artifact === input.artifact) {
		return baseTaskId;
	}

	const artifactIdentity = getInferredArtifactIdentity(input.artifact);
	let fallbackTaskId = `${input.artifactName}#${artifactIdentity}@${input.injectAt}`;
	let suffix = 2;
	while (true) {
		const existingFallbackTask = runtime.taskContext.get(fallbackTaskId);
		if (!existingFallbackTask) {
			return fallbackTaskId;
		}
		if (
			isArtifactTask(existingFallbackTask) &&
			existingFallbackTask.artifact === input.artifact
		) {
			return fallbackTaskId;
		}
		fallbackTaskId = `${input.artifactName}#${artifactIdentity}-${suffix}@${input.injectAt}`;
		suffix++;
	}
}

function getInferredArtifactIdentity(artifact: unknown): string {
	if ((typeof artifact !== 'object' && typeof artifact !== 'function') || artifact === null) {
		inferredArtifactIdCount++;
		return `artifact-${inferredArtifactIdCount}`;
	}

	const key = artifact as object;
	const cached = inferredArtifactIds.get(key);
	if (cached) {
		return cached;
	}

	inferredArtifactIdCount++;
	const id = `artifact-${inferredArtifactIdCount}`;
	inferredArtifactIds.set(key, id);
	return id;
}
