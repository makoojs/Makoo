<script setup lang="ts">
import { computed } from 'vue';
import { useData, useRoute } from 'vitepress';
import { isApiSitePath, isChineseLocale, isGuideSitePath, normalizeSitePath } from '../locale';

const { lang, localeIndex, site } = useData();
const route = useRoute();
const isChinese = computed(() => isChineseLocale(localeIndex.value, lang.value));
const section = computed(() => {
	const path = normalizeSitePath(route.path, site.value.base);
	if (isGuideSitePath(path)) return isChinese.value ? '文档' : 'Docs';
	if (isApiSitePath(path)) return 'API';
	return null;
});
</script>

<template>
	<span v-if="section" class="nav-docs-label">
		<span class="nav-brand-divider" aria-hidden="true">/</span>
		{{ section }}
	</span>
</template>
