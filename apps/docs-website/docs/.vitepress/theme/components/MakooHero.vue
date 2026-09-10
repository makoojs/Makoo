<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import MakooHomeContent from './MakooHomeContent.vue';
import { useRoute, withBase } from 'vitepress';

type Locale = 'en' | 'zh';
type CopyState = 'idle' | 'loading' | 'success' | 'error';

const route = useRoute();
const locale = computed<Locale>(() => (route.path.startsWith('/zh/') ? 'zh' : 'en'));
const command = 'pnpm dlx @makoojs/create-makoo';
const copyState = ref<CopyState>('idle');
let copyResetTimer: number | undefined;

const messages = {
	en: {
		eyebrow: 'Component-driven userscript framework', title: 'Add your own touches to everyday pages.',
		lead: 'Makoo is a framework for building userscripts. Write components in Vue or React, and use Makoo to inject them, wait for page elements, and clean up tasks.',
		getStarted: 'Get started', github: 'View source', copy: 'Copy', copying: 'Copying', copied: 'Copied', copyError: 'Copy failed',
		copySuccessStatus: 'The create command was copied to your clipboard.', copyErrorStatus: 'Copy failed. Select the command manually.',
		footer: 'Component-driven userscript framework', docs: 'Docs', api: 'API'
	},
	zh: {
		eyebrow: '组件化 userscript 开发框架', title: '给常用的网页，\n添一点自己的功能。',
		lead: 'Makoo 是一个用于开发用户脚本的框架。用 Vue 或 React 编写组件，由 Makoo 处理组件注入、等待页面元素和任务清理。',
		getStarted: '开始使用', github: '查看源代码', copy: '复制', copying: '正在复制', copied: '已复制', copyError: '复制失败',
		copySuccessStatus: '创建命令已复制到剪贴板。', copyErrorStatus: '复制失败，请手动选择命令。',
		footer: '组件化 userscript 开发框架', docs: '文档', api: 'API'
	}
} as const;

const content = computed(() => messages[locale.value]);
const docsLink = computed(() => withBase(locale.value === 'zh' ? '/zh/docs/getting-started' : '/docs/getting-started'));
const apiLink = computed(() => withBase(locale.value === 'zh' ? '/zh/api/core' : '/api/core'));
const copyLabel = computed(() => copyState.value === 'loading' ? content.value.copying : copyState.value === 'success' ? content.value.copied : copyState.value === 'error' ? content.value.copyError : content.value.copy);

function fallbackCopy(value: string): boolean {
	const textarea = document.createElement('textarea');
	textarea.value = value;
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	document.body.appendChild(textarea);
	textarea.select();
	const copied = document.execCommand('copy');
	textarea.remove();
	return copied;
}

async function copyCommand(): Promise<void> {
	if (copyState.value === 'loading') return;
	copyState.value = 'loading';
	try {
		if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(command);
		else if (!fallbackCopy(command)) throw new Error('copy failed');
		copyState.value = 'success';
	} catch {
		copyState.value = 'error';
	}
	if (copyResetTimer) window.clearTimeout(copyResetTimer);
	copyResetTimer = window.setTimeout(() => { copyState.value = 'idle'; }, 1800);
}

onBeforeUnmount(() => {
	if (copyResetTimer) window.clearTimeout(copyResetTimer);
});
</script>

<template>
	<div class="makoo-home-shell" :lang="locale">
		<section class="hero" aria-labelledby="home-title">
			<div class="hero-aurora" aria-hidden="true"></div>
			<p class="eyebrow">{{ content.eyebrow }}</p>
			<h1 id="home-title"><template v-for="(line, index) in content.title.split('\n')" :key="index"><br v-if="index" />{{ line }}</template></h1>
			<p class="hero-lead">{{ content.lead }}</p>
			<div class="hero-actions"><a class="primary-link" :href="docsLink">{{ content.getStarted }}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4" /></svg></a>
					<a class="secondary-link" href="https://github.com/makoojs/Makoo"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.02-1.91-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.75-.1-.26-.45-1.3.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.98c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.71 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" /></svg>{{ content.github }}</a></div>
			<div class="install-command"><span class="command-prompt" aria-hidden="true">$</span><code>{{ command }}</code><button class="copy-command" type="button" :data-copy-state="copyState" :disabled="copyState === 'loading'" @click="copyCommand"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="6" y="6" width="9" height="9" rx="2" /><path d="M4 12H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" /></svg><span>{{ copyLabel }}</span></button><span class="sr-only" role="status" aria-live="polite">{{ copyState === 'success' ? content.copySuccessStatus : copyState === 'error' ? content.copyErrorStatus : '' }}</span></div>
		</section>

		<MakooHomeContent :key="locale" :locale="locale" />
		<footer class="site-footer">
			<div class="footer-brand">Makoo · {{ content.footer }}</div>
			<div class="footer-links"><a :href="docsLink">{{ content.docs }}</a><a :href="apiLink">{{ content.api }}</a><a href="https://github.com/makoojs/Makoo">GitHub</a></div>
		</footer>
	</div>
</template>
