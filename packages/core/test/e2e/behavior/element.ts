export function element<T extends HTMLElement = HTMLElement>(selector: string): T {
	const result = document.querySelector<T>(selector);
	if (!result) throw new Error(`Missing fixture element: ${selector}`);
	return result;
}
