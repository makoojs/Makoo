import {
	GM_addValueChangeListener,
	GM_deleteValue,
	GM_deleteValues,
	GM_getValue,
	GM_getValues,
	GM_listValues,
	GM_removeValueChangeListener,
	GM_setValue,
	GM_setValues
} from 'vite-plugin-monkey/dist/client';

/** Persistent values stored by the script manager. */
export const gmStorage = {
	/** `GM_getValue`. */
	get: GM_getValue,
	/** `GM_getValues`. */
	getMany: GM_getValues,
	/** `GM_setValue`. */
	set: GM_setValue,
	/** `GM_setValues`. */
	setMany: GM_setValues,
	/** `GM_deleteValue`. */
	remove: GM_deleteValue,
	/** `GM_deleteValues`. */
	removeMany: GM_deleteValues,
	/** `GM_listValues`. */
	keys: GM_listValues,
	/** `GM_addValueChangeListener`. */
	watch: GM_addValueChangeListener,
	/** `GM_removeValueChangeListener`. */
	unwatch: GM_removeValueChangeListener
};
