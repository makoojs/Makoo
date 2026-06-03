import { memo } from 'react';
import { describe, expect, it } from 'vitest';
import { isReactMountArtifact } from '../src/util';

describe('isReactMountArtifact', () => {
	it('returns true for function components', () => {
		function Badge() {
			return null;
		}

		expect(isReactMountArtifact(Badge)).toBe(true);
	});

	it('returns true for React exotic components', () => {
		const MemoBadge = memo(function Badge() {
			return null;
		});
		const fakeExotic = {
			$$typeof: Symbol.for('react.memo')
		};

		expect(isReactMountArtifact(MemoBadge)).toBe(true);
		expect(isReactMountArtifact(fakeExotic)).toBe(true);
	});

	it('returns false for null and plain objects', () => {
		expect(isReactMountArtifact(null)).toBe(false);
		expect(isReactMountArtifact({})).toBe(false);
		expect(isReactMountArtifact({ $$typeof: 'not-a-symbol' })).toBe(false);
	});
});
