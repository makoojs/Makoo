<script setup lang="ts">
import { useCounter } from './store';
const counter = useCounter();
</script>

<template>
	<button id="vue-increment" @click="counter.increment()">Vue: {{ counter.count }}</button>
</template>
