import { GM_addElement, GM_addStyle } from 'vite-plugin-monkey/dist/client';

export const gmStyle = {
	add: GM_addStyle,
	element: GM_addElement
};
