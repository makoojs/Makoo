import { GM_getResourceText, GM_getResourceURL } from 'vite-plugin-monkey/dist/client';

/** Resources declared with `@resource`. */
export const gmResource = {
	/** `GM_getResourceText`. */
	text: GM_getResourceText,
	/** `GM_getResourceURL`. */
	url: GM_getResourceURL
};
