import { GM_registerMenuCommand, GM_unregisterMenuCommand } from 'vite-plugin-monkey/dist/client';

/** Commands in the script manager's menu. */
export const gmMenu = {
	/** `GM_registerMenuCommand`. */
	register: GM_registerMenuCommand,
	/** `GM_unregisterMenuCommand`. */
	unregister: GM_unregisterMenuCommand
};
