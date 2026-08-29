<script setup lang="ts">
import { computed } from 'vue';
import { useData, useRoute } from 'vitepress';

const { page } = useData();
const route = useRoute();
const isChinese = computed(() => route.path.startsWith('/zh/'));
const section = computed(() => route.path.includes('/api/') ? 'API' : (isChinese.value ? '文档' : 'Docs'));
</script>

<template>
	<nav class="makoo-breadcrumb mb-3 flex gap-2.25 text-xs leading-normal" :aria-label="isChinese ? '当前位置' : 'Breadcrumb'" data-od-id="docs-breadcrumb">
		<span>{{ section }}</span><span aria-hidden="true">/</span><span>{{ page.title }}</span>
	</nav>
</template>
