<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vitepress';

const route = useRoute();
const section = computed(() => {
	const parts = route.path.split('/').filter(Boolean);
	const key = parts[0] === 'zh' ? parts[1] : parts[0];
	if (key === 'docs') return 'Docs';
	if (key === 'api') return 'API';
	return null;
});
</script>

<template>
	<span v-if="section" class="nav-docs-label">
		<span class="nav-brand-divider" aria-hidden="true">/</span>
		{{ section }}
	</span>
</template>
