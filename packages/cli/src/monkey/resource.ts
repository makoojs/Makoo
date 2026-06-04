import { GM_getResourceText, GM_getResourceURL } from 'vite-plugin-monkey/dist/client';

export const gmResource = {
	text: GM_getResourceText,
	url: GM_getResourceURL
};
