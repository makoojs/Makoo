import type { GmResponseType, GmXmlhttpRequestOption } from 'vite-plugin-monkey/dist/client';
import { GM_xmlhttpRequest } from 'vite-plugin-monkey/dist/client';

/** `GM_xmlhttpRequest` options without `url` and `method`, which the shortcut sets. */
export type GmRequestOptions<R extends GmResponseType = 'text', C = unknown> = Omit<
	GmXmlhttpRequestOption<R, C>,
	'url' | 'method'
>;

/**
 * Cross-origin requests through the script manager. Responses arrive through callbacks such as
 * `onload`; allow the target domains with `monkey.userscript.connect`.
 */
export const gmRequest = {
	/** `GM_xmlhttpRequest`. */
	send: GM_xmlhttpRequest,
	/** Sends a `GET` request; returns a handle whose `abort()` cancels it. */
	get<R extends GmResponseType = 'text', C = unknown>(
		url: string,
		options?: GmRequestOptions<R, C>
	) {
		return GM_xmlhttpRequest<R, C>({
			...(options ?? {}),
			url,
			method: 'GET'
		});
	},
	/** Sends a `POST` request; returns a handle whose `abort()` cancels it. */
	post<R extends GmResponseType = 'text', C = unknown>(
		url: string,
		options?: GmRequestOptions<R, C>
	) {
		return GM_xmlhttpRequest<R, C>({
			...(options ?? {}),
			url,
			method: 'POST'
		});
	}
};
