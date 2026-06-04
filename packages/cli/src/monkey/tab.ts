import { GM_getTab, GM_getTabs, GM_openInTab, GM_saveTab } from 'vite-plugin-monkey/dist/client';

export const gmTab = {
	open: GM_openInTab,
	get: GM_getTab,
	getAll: GM_getTabs,
	save: GM_saveTab
};
