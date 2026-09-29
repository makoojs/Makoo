import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter, VuePlugin } from '@makoojs/vue';
import { createPinia } from 'pinia';
import Counter from './Counter.vue';

VuePlugin.use(createPinia());
createMakoo({ adapters: [createVueAdapter()] }).start([
	inject({ id: 'vue-counter', injectAt: '#app', artifact: Counter })
]);
