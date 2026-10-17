import { GM_setClipboard } from 'vite-plugin-monkey/dist/client';

/** Clipboard access through the script manager. */
export const gmClipboard = {
	/** Copies `data` to the clipboard with `GM_setClipboard`; `type` defaults to `text/plain`. */
	set(data: string, type = 'text/plain', callback?: () => void) {
		return GM_setClipboard(data, type, callback);
	}
};
