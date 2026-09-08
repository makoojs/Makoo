import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vite-plugin-monkey/dist/client', () => {
	return {
		GM: { getValue: vi.fn() },
		GM_addElement: vi.fn(),
		GM_addStyle: vi.fn(),
		GM_addValueChangeListener: vi.fn(),
		GM_deleteValue: vi.fn(),
		GM_deleteValues: vi.fn(),
		GM_download: vi.fn(),
		GM_getResourceText: vi.fn(),
		GM_getResourceURL: vi.fn(),
		GM_getTab: vi.fn(),
		GM_getTabs: vi.fn(),
		GM_getValue: vi.fn(),
		GM_getValues: vi.fn(),
		GM_info: { script: { name: 'test-script' } },
		GM_listValues: vi.fn(),
		GM_log: vi.fn(),
		GM_notification: vi.fn(),
		GM_openInTab: vi.fn(),
		GM_registerMenuCommand: vi.fn(),
		GM_removeValueChangeListener: vi.fn(),
		GM_saveTab: vi.fn(),
		GM_setClipboard: vi.fn(),
		GM_setValue: vi.fn(),
		GM_setValues: vi.fn(),
		GM_unregisterMenuCommand: vi.fn(),
		GM_xmlhttpRequest: vi.fn(),
		monkeyWindow: {},
		unsafeWindow: {}
	};
});

import {
	GM_getResourceText,
	GM_getResourceURL,
	GM_getValue,
	GM_setClipboard,
	GM_setValue,
	GM_xmlhttpRequest
} from 'vite-plugin-monkey/dist/client';

beforeEach(() => vi.clearAllMocks());

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
} from '../../src/monkey';

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

	it('maps storage and resource helpers to the correct raw API', () => {
		expect(gmStorage.get).toBe(GM_getValue);
		expect(gmStorage.set).toBe(GM_setValue);
		expect(gmResource.text).toBe(GM_getResourceText);
		expect(gmResource.url).toBe(GM_getResourceURL);
		expect(gmRequest.send).toBe(GM_xmlhttpRequest);
	});

	it.each([
		'get',
		'post'
	] as const)('%s forwards request options and returns the abort handle', (method) => {
		const abort = { abort: vi.fn() };
		vi.mocked(GM_xmlhttpRequest).mockReturnValue(abort);
		const onload = vi.fn();
		const options = {
			headers: { Authorization: 'test-token' },
			data: 'payload',
			timeout: 500,
			onload
		};
		const result = gmRequest[method]('https://example.com/api', options);
		expect(GM_xmlhttpRequest).toHaveBeenCalledExactlyOnceWith({
			...options,
			url: 'https://example.com/api',
			method: method.toUpperCase()
		});
		expect(result).toBe(abort);
		expect(options).not.toHaveProperty('url');
	});

	it('supports a request without options', () => {
		gmRequest.get('https://example.com/');
		expect(GM_xmlhttpRequest).toHaveBeenCalledExactlyOnceWith({
			url: 'https://example.com/',
			method: 'GET'
		});
	});

	it('defaults clipboard content type and forwards custom type and callback', () => {
		gmClipboard.set('hello');
		expect(GM_setClipboard).toHaveBeenLastCalledWith('hello', 'text/plain', undefined);
		const done = vi.fn();
		gmClipboard.set('<b>hello</b>', 'text/html', done);
		expect(GM_setClipboard).toHaveBeenLastCalledWith('<b>hello</b>', 'text/html', done);
	});
});
