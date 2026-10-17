import { describe, expect, it } from 'vitest';
import { ReactErrorCode } from '../src';

describe('ReactErrorCode', () => {
	it('publishes the React error code', () => {
		expect(ReactErrorCode).toEqual({
			REACT_HOOK_OUTSIDE_COMPONENT: 'MAKOO_REACT_HOOK_OUTSIDE_COMPONENT'
		});
	});
});
