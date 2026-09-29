import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import { Counter } from './Counter';

createMakoo({ adapters: [createReactAdapter()] }).start([
	inject({ id: 'react-counter', injectAt: '#app', artifact: Counter })
]);
