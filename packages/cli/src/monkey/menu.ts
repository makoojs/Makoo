import { GM_registerMenuCommand, GM_unregisterMenuCommand } from 'vite-plugin-monkey/dist/client';

export const gmMenu = {
	register: GM_registerMenuCommand,
	unregister: GM_unregisterMenuCommand
};
