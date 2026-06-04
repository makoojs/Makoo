import { GM_setClipboard } from 'vite-plugin-monkey/dist/client';

export const gmClipboard = {
	set(data: string, type = 'text/plain', callback?: () => void) {
		return GM_setClipboard(data, type, callback);
	}
};
