import type { GmResponseType, GmXmlhttpRequestOption } from 'vite-plugin-monkey/dist/client';
import { GM_xmlhttpRequest } from 'vite-plugin-monkey/dist/client';

export type GmRequestOptions<R extends GmResponseType = 'text', C = unknown> = Omit<
	GmXmlhttpRequestOption<R, C>,
	'url' | 'method'
>;

export const gmRequest = {
	send: GM_xmlhttpRequest,
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
