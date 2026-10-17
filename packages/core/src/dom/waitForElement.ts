import type { DOMObserver } from './observer';

export const DEFAULT_DOM_TIMEOUT = 15000;

export function waitForElement(
	observer: DOMObserver,
	selector: string,
	signal: AbortSignal,
	timeout: number,
	onFound: (element: Element) => void,
	onTimeout: () => void,
	onError: (cause: unknown) => void
): void {
	if (signal.aborted) return;
	let active = true;
	let unsubscribe = () => {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	const cancel = () => {
		active = false;
		unsubscribe();
		clearTimeout(timer);
		signal.removeEventListener('abort', cancel);
	};
	const check = () => {
		if (!active || signal.aborted) return;
		let element: Element | null;
		try {
			element = document.querySelector(selector);
		} catch (cause) {
			cancel();
			onError(cause);
			return;
		}
		if (!active || signal.aborted || !element?.isConnected) return;
		cancel();
		onFound(element);
	};
	unsubscribe = observer.subscribe(check, signal);
	signal.addEventListener('abort', cancel, { once: true });
	timer = setTimeout(() => {
		if (!active || signal.aborted) return;
		cancel();
		onTimeout();
	}, timeout);
	check();
}
