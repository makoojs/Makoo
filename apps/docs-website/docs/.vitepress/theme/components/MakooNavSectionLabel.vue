<script setup lang="ts">
import { computed } from 'vue';
import { useData, useRoute } from 'vitepress';

const { lang, localeIndex } = useData();
const route = useRoute();

const isChinese = computed(() => {
	if (localeIndex.value === 'zh' || lang.value?.toLowerCase().startsWith('zh')) return true;
	const p = route.path;
	return p.startsWith('/zh/') || p === '/zh' || p.includes('/zh/');
});

const section = computed(() => {
	const p = route.path;
	if (p.includes('/docs/') || p.endsWith('/docs')) return isChinese.value ? '文档' : 'Docs';
	if (p.includes('/api/') || p.endsWith('/api')) return 'API';
	return null;
});
</script>

<template>
	<span v-if="section" class="nav-docs-label">
		<span class="nav-brand-divider" aria-hidden="true">/</span>
		{{ section }}
	</span>
</template>
