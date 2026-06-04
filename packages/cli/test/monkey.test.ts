import { describe, expect, it, vi } from 'vitest';

vi.mock('vite-plugin-monkey/dist/client', () => {
	const fn = vi.fn();

	return {
		GM: { getValue: fn },
		GM_addElement: fn,
		GM_addStyle: fn,
		GM_addValueChangeListener: fn,
		GM_deleteValue: fn,
		GM_deleteValues: fn,
		GM_download: fn,
		GM_getResourceText: fn,
		GM_getResourceURL: fn,
		GM_getTab: fn,
		GM_getTabs: fn,
		GM_getValue: fn,
		GM_getValues: fn,
		GM_info: { script: { name: 'test-script' } },
		GM_listValues: fn,
		GM_log: fn,
		GM_notification: fn,
		GM_openInTab: fn,
		GM_registerMenuCommand: fn,
		GM_removeValueChangeListener: fn,
		GM_saveTab: fn,
		GM_setClipboard: fn,
		GM_setValue: fn,
		GM_setValues: fn,
		GM_unregisterMenuCommand: fn,
		GM_xmlhttpRequest: fn,
		monkeyWindow: {},
		unsafeWindow: {}
	};
});

import {
	GMapi,
	gmClipboard,
	gmDownload,
	gmMenu,
	gmNotification,
	gmRequest,
	gmResource,
	gmStorage,
	gmStyle,
	gmTab
} from '../src/monkey';

describe('monkey api exports', () => {
	it('groups GM helpers under GMapi', () => {
		expect(GMapi.storage).toBe(gmStorage);
		expect(GMapi.style).toBe(gmStyle);
		expect(GMapi.request).toBe(gmRequest);
		expect(GMapi.menu).toBe(gmMenu);
		expect(GMapi.clipboard).toBe(gmClipboard);
		expect(GMapi.notification).toBe(gmNotification);
		expect(GMapi.tab).toBe(gmTab);
		expect(GMapi.download).toBe(gmDownload);
		expect(GMapi.resource).toBe(gmResource);
	});

	it('adds method helpers without hiding the raw request API', () => {
		expect(gmRequest.send).toBeTypeOf('function');
		expect(gmRequest.get).toBeTypeOf('function');
		expect(gmRequest.post).toBeTypeOf('function');
	});
});
