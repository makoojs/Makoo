import type { ResolvedInjectionModule } from '../config/types';

export function mergeMeta(
	source: ResolvedInjectionModule[],
	target: ResolvedInjectionModule[]
): ResolvedInjectionModule[] {
	const targetMap = new Map(target.map((m) => [m.moduleId, m]));
	const result = source.map((s) => targetMap.get(s.moduleId) ?? s);
	for (const t of target) {
		if (!source.some((s) => s.moduleId === t.moduleId)) {
			result.push(t);
		}
	}
	return result;
}
