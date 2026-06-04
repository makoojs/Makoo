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

export const gmStorage = {
	get: GM_getValue,
	getMany: GM_getValues,
	set: GM_setValue,
	setMany: GM_setValues,
	remove: GM_deleteValue,
	removeMany: GM_deleteValues,
	keys: GM_listValues,
	watch: GM_addValueChangeListener,
	unwatch: GM_removeValueChangeListener
};
