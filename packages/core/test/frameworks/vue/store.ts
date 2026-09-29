import { defineStore } from 'pinia';

export const useCounter = defineStore('fixture-counter', {
	state: () => ({ count: 0 }),
	actions: {
		increment() {
			this.count += 1;
		}
	}
});
