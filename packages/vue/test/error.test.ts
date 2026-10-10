import { describe, expect, it } from 'vitest';
import { VueErrorCode } from '../src';

describe('VueErrorCode', () => {
	it('publishes the Vue error codes', () => {
		expect(VueErrorCode).toEqual({
			VUE_HOOK_OUTSIDE_COMPONENT: 'MAKOO_VUE_HOOK_OUTSIDE_COMPONENT',
			VUE_HOOK_OUTSIDE_SCOPE: 'MAKOO_VUE_HOOK_OUTSIDE_SCOPE',
			VUE_PARTIAL_MOUNT_UNCONFIRMED: 'MAKOO_VUE_PARTIAL_MOUNT_UNCONFIRMED'
		});
	});
});
