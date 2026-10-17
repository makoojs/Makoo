import { GM, GM_info, GM_log, monkeyWindow, unsafeWindow } from 'vite-plugin-monkey/dist/client';

/** The promise-based `GM` object. */
export const gm = GM;
/** `GM_info`: details about the script and the script manager. */
export const gmInfo = GM_info;
/** `GM_log`. */
export const gmLog = GM_log;
export { monkeyWindow, unsafeWindow };
