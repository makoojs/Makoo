import { GM_addElement, GM_addStyle } from 'vite-plugin-monkey/dist/client';

/** Styles and elements added through the script manager. */
export const gmStyle = {
	/** `GM_addStyle`. */
	add: GM_addStyle,
	/** `GM_addElement`. */
	element: GM_addElement
};
