export { gmClipboard } from './clipboard';
export { gmDownload } from './download';
export { gm, gmInfo, gmLog, monkeyWindow, unsafeWindow } from './info';
export { gmMenu } from './menu';
export { gmNotification } from './notification';
export type { GmRequestOptions } from './request';
export { gmRequest } from './request';
export { gmResource } from './resource';
export { gmStorage } from './storage';
export { gmStyle } from './style';
export { gmTab } from './tab';

import { gmClipboard } from './clipboard';
import { gmDownload } from './download';
import { gm, gmInfo, gmLog } from './info';
import { gmMenu } from './menu';
import { gmNotification } from './notification';
import { gmRequest } from './request';
import { gmResource } from './resource';
import { gmStorage } from './storage';
import { gmStyle } from './style';
import { gmTab } from './tab';

export const GMapi = {
	raw: gm,
	info: gmInfo,
	log: gmLog,
	storage: gmStorage,
	style: gmStyle,
	request: gmRequest,
	menu: gmMenu,
	clipboard: gmClipboard,
	notification: gmNotification,
	tab: gmTab,
	download: gmDownload,
	resource: gmResource
};

export type {
	GmAbortHandle,
	GmAddElementAttributes,
	GmDownloadOptions,
	GmInfoType,
	GmMenuCommandOptions,
	GmNotificationOptions,
	GmOpenInTabOptions,
	GmResponseEvent,
	GmResponseType,
	GmTabControl,
	GmType,
	GmValueListenerId,
	GmXmlhttpRequestOption,
	MonkeyWindow
} from 'vite-plugin-monkey/dist/client';
