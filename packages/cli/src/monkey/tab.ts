import { GM_getTab, GM_getTabs, GM_openInTab, GM_saveTab } from 'vite-plugin-monkey/dist/client';

/** Browser tabs and per-tab data. */
export const gmTab = {
	/** `GM_openInTab`. */
	open: GM_openInTab,
	/** `GM_getTab`. */
	get: GM_getTab,
	/** `GM_getTabs`. */
	getAll: GM_getTabs,
	/** `GM_saveTab`. */
	save: GM_saveTab
};
