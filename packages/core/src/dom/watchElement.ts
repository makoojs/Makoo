import type { DOMObserver } from './observer';

export function watchElement(
	observer: DOMObserver,
	element: Element,
	signal: AbortSignal,
	onInvalid: () => void,
	isValid: () => boolean = () => element.isConnected
): void {
	if (signal.aborted) return;
	const check = () => {
		if (signal.aborted || isValid()) return;
		unsubscribe();
		onInvalid();
	};
	const unsubscribe = observer.subscribe(check, signal);
	check();
}
