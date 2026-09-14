<script setup lang="ts">
import { computed } from 'vue';
import { useData, useRoute } from 'vitepress';
import { isApiSitePath, isChineseLocale, normalizeSitePath } from '../locale';

const { page, lang, localeIndex, site } = useData();
const route = useRoute();
const isChinese = computed(() => isChineseLocale(localeIndex.value, lang.value));
const section = computed(() => {
	const path = normalizeSitePath(route.path, site.value.base);
	if (isApiSitePath(path)) return 'API';
	return isChinese.value ? '文档' : 'Docs';
});
</script>

<template>
	<nav class="makoo-breadcrumb mb-3 flex gap-2.25 text-xs leading-normal" :aria-label="isChinese ? '当前位置' : 'Breadcrumb'" data-od-id="docs-breadcrumb">
		<span>{{ section }}</span><span aria-hidden="true">/</span><span>{{ page.title }}</span>
	</nav>
</template>
