<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vitepress';

const route = useRoute();

const logLines = [
	{
		level: 'INFO',
		message: 'Task "header-badge" registered',
		stage: 'register'
	},
	{
		level: 'INFO',
		message: 'Element "#header" found, observer disconnected',
		stage: 'target'
	},
	{
		level: 'INFO',
		message: 'Artifact "HeaderBadge" injected at "#header"',
		stage: 'inject'
	},
	{
		level: 'INFO',
		message: 'Task "header-badge" alive observer activated',
		stage: 'alive'
	}
];

const messages = {
	en: {
		tagline: 'A development framework for component-driven userscripts.',
		description:
			'Makoo provides a stable injection runtime for userscript projects, so you can build script interfaces on real web pages with Vue or React.',
		getStarted: 'Get Started',
		github: 'View on GitHub',
		whyTitle: 'Why Makoo?',
		whyDescription:
			'Built for component-driven userscripts. Makoo provides a stable injection runtime, so you can focus on building interfaces instead of repeatedly handling DOM targeting, mounting, and reinjection.',
		benefits: [
			{
				icon: 'layers',
				title: 'Component-first',
				text: 'Build injected UI with Vue or React instead of scattered DOM operations and string templates.'
			},
			{
				icon: 'target',
				title: 'DOM-aware runtime',
				text: 'Wait for target nodes, observe page redraws, and keep injection behavior stable on real sites.'
			},
			{
				icon: 'workflow',
				title: 'Predictable lifecycle',
				text: 'Register, mount, observe, reinject, and destroy injection tasks through one runtime model.'
			},
			{
				icon: 'zap',
				title: 'Vite-native workflow',
				text: 'Keep fast local development, TypeScript builds, and userscript tooling inside the Vite ecosystem.'
			}
		]
	},
	zh: {
		tagline: '面向组件化开发的 userscript 框架。',
		description:
			'Makoo 为用户脚本项目提供稳定的注入运行时，让你用 Vue 或 React 构建真实网页上的脚本界面。',
		getStarted: '快速开始',
		github: '查看 GitHub',
		whyTitle: '为什么选择 Makoo？',
		whyDescription:
			'为组件化用户脚本而生。Makoo 提供稳定的注入运行时，让你专注于构建界面，而不是反复处理 DOM、挂载和重新注入。',
		benefits: [
			{
				icon: 'layers',
				title: '组件优先',
				text: '用 Vue 或 React 构建注入式 UI，避免分散的 DOM 操作和字符串模板。'
			},
			{
				icon: 'target',
				title: '理解 DOM 的运行时',
				text: '等待目标节点，观察页面重绘，并让真实网站上的注入行为保持稳定。'
			},
			{
				icon: 'workflow',
				title: '可预测的生命周期',
				text: '用同一套运行时模型注册、挂载、观察、重新注入和销毁注入任务。'
			},
			{
				icon: 'zap',
				title: 'Vite 原生工作流',
				text: '保留快速本地开发、TypeScript 构建和用户脚本工具链，并继续使用 Vite 生态。'
			}
		]
	}
};

const activeLine = ref(0);
let timer: number | undefined;

const locale = computed(() => (route.path.startsWith('/zh/') ? 'zh' : 'en'));
const content = computed(() => messages[locale.value]);
const docsLink = computed(() => (locale.value === 'zh' ? '/zh/docs/' : '/docs/'));
const activeStage = computed(() => logLines[activeLine.value]?.stage ?? 'register');

function formatLine(message: string, index: number): string {
	const ms = String(312 + index * 107).padStart(3, '0');
	return `[Makoo][INFO][2026-06-06T10:24:12.${ms}Z] ${message}`;
}

onMounted(() => {
	timer = window.setInterval(() => {
		activeLine.value = activeLine.value === logLines.length - 1 ? 0 : activeLine.value + 1;
	}, 1600);
});

onBeforeUnmount(() => {
	if (timer) window.clearInterval(timer);
});
</script>

<template>
	<div class="makoo-home-shell overflow-hidden text-slate-950 dark:text-slate-50">
		<section class="makoo-hero-section grid w-full items-center gap-12 px-6 py-16 md:px-10 md:py-20 lg:gap-16 lg:px-14 lg:py-16 2xl:px-20">
			<div class="min-w-0">
				<div class="makoo-hero-name">Makoo</div>
				<h1 class="makoo-hero-title m-0 mt-5 max-w-3xl text-5xl font-extrabold tracking-normal text-slate-950 dark:text-white">
					{{ content.tagline }}
				</h1>
				<p class="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-700 dark:text-slate-300">
					{{ content.description }}
				</p>
				<div class="mt-8 flex flex-wrap gap-3">
					<a class="makoo-primary-link inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold transition" :href="docsLink">
						{{ content.getStarted }}
					</a>
					<a class="makoo-secondary-link inline-flex h-11 items-center rounded-md border border-slate-300 bg-white/70 px-5 text-sm font-semibold transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-violet-400" href="https://github.com/makoojs/Makoo">
						{{ content.github }}
					</a>
				</div>
			</div>

			<div class="relative min-w-0">
				<div class="absolute -left-6 top-12 h-40 w-40 rounded-full bg-blue-400/12 blur-3xl"></div>
				<div class="absolute -right-4 bottom-12 h-48 w-48 rounded-full bg-violet-400/12 blur-3xl"></div>
				<div class="relative w-full overflow-hidden rounded-xl border border-blue-900/10 bg-white/95 shadow-2xl shadow-blue-950/10 backdrop-blur md:rounded-2xl dark:border-white/10 dark:bg-slate-950/90 dark:shadow-violet-950/20">
					<div class="flex h-10 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 md:h-11 md:px-4 dark:border-white/10 dark:bg-slate-900">
						<span class="h-2.5 w-2.5 rounded-full bg-red-400 md:h-3 md:w-3"></span>
						<span class="h-2.5 w-2.5 rounded-full bg-amber-400 md:h-3 md:w-3"></span>
						<span class="h-2.5 w-2.5 rounded-full bg-emerald-400 md:h-3 md:w-3"></span>
						<span class="ml-2 truncate text-xs font-medium text-slate-500 md:ml-3 dark:text-slate-400">example.com/profile</span>
					</div>
					<div class="makoo-preview-grid grid gap-0">
						<div class="min-h-70 bg-blue-50/40 p-3 md:min-h-105 md:p-5 dark:bg-slate-900/70">
							<div class="rounded-lg border border-blue-900/10 bg-white p-3 shadow-sm md:p-4 dark:border-white/10 dark:bg-slate-950">
								<div
									class="mb-3 flex items-center justify-between rounded-md border p-3 transition md:mb-4"
									:class="activeStage === 'target' || activeStage === 'inject' || activeStage === 'alive'
										? 'border-blue-400 bg-blue-50 ring-4 ring-violet-500/10 dark:bg-blue-400/10'
										: 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5'"
								>
									<div>
										<div class="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">#header</div>
										<div class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Profile header</div>
									</div>
									<div class="rounded bg-slate-200 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">DOM</div>
								</div>
								<div
									class="mb-3 rounded-md border border-blue-300 bg-white p-3 shadow-lg shadow-blue-500/10 transition-all duration-500 md:mb-4 dark:border-violet-400/50 dark:bg-slate-900"
									:class="activeStage === 'inject' || activeStage === 'alive'
										? 'translate-y-0 opacity-100'
										: 'translate-y-3 opacity-0'"
								>
									<div class="flex items-center gap-3">
										<div>
											<div class="text-sm font-semibold text-slate-950 dark:text-white">HeaderBadge</div>
											<div class="text-xs text-slate-500 dark:text-slate-400">Injected by Vue adapter</div>
										</div>
									</div>
								</div>
								<div class="space-y-2 md:space-y-3">
									<div class="h-10 rounded-md bg-slate-100 md:h-16 dark:bg-white/5"></div>
									<div class="h-14 rounded-md bg-slate-100 md:h-24 dark:bg-white/5"></div>
									<div class="h-8 rounded-md bg-slate-100 md:h-12 dark:bg-white/5"></div>
								</div>
							</div>
						</div>
						<div class="border-t border-slate-200 bg-slate-50 p-3 md:p-5 lg:border-l lg:border-t-0 dark:border-white/10 dark:bg-slate-950">
							<div class="mb-3 flex items-center justify-between">
								<div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">DevTools Console</div>
								<div
									class="rounded-full border px-2 py-1 text-xs font-medium transition"
									:class="activeStage === 'alive'
										? 'border-violet-400/70 bg-blue-100 text-blue-700 dark:bg-violet-400/10 dark:text-violet-200'
										: 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'"
								>
									{{ activeStage === 'alive' ? 'watching' : 'runtime' }}
								</div>
							</div>
							<div class="makoo-console-stack h-56 space-y-2 overflow-hidden font-mono leading-5 md:h-90 md:space-y-3">
								<div
									v-for="(line, index) in logLines"
									:key="line.message"
									class="h-12 overflow-hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm transition-all duration-300 md:h-18 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
									:class="index <= activeLine ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'"
								>
									<span class="block whitespace-normal wrap-break-word text-emerald-700 dark:text-emerald-300">{{ formatLine(line.message, index) }}</span>
								</div>
								<div class="h-5 w-2 animate-pulse bg-emerald-300"></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="py-24 text-slate-950 dark:text-white">
			<div class="w-full px-6 md:px-10 lg:px-14 2xl:px-20">
				<div class="mb-14">
					<h2 class="makoo-gradient-text m-0 text-5xl font-extrabold tracking-normal md:text-6xl">{{ content.whyTitle }}</h2>
					<p class="m-0 mt-5 max-w-3xl text-xl font-medium leading-8 text-slate-600 dark:text-white/60">
						{{ content.whyDescription }}
					</p>
				</div>
				<div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
				<div
					v-for="benefit in content.benefits"
					:key="benefit.title"
						class="rounded-2xl border border-blue-900/10 bg-white/80 p-8 shadow-sm shadow-blue-950/5 transition hover:-translate-y-1 hover:border-violet-300/50 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:shadow-violet-950/10 dark:hover:bg-white/10"
				>
						<div class="mb-10 grid h-14 w-14 place-items-center rounded-xl bg-linear-to-br from-emerald-400 via-blue-500 to-violet-600 text-sm font-extrabold text-white shadow-lg shadow-blue-950/30">
							<svg
								class="h-7 w-7"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<template v-if="benefit.icon === 'layers'">
									<path d="m12 3 8 4-8 4-8-4 8-4Z" />
									<path d="m4 11 8 4 8-4" />
									<path d="m4 15 8 4 8-4" />
								</template>
								<template v-else-if="benefit.icon === 'target'">
									<circle cx="12" cy="12" r="8" />
									<circle cx="12" cy="12" r="3" />
									<path d="M12 2v3" />
									<path d="M12 19v3" />
									<path d="M2 12h3" />
									<path d="M19 12h3" />
								</template>
								<template v-else-if="benefit.icon === 'workflow'">
									<rect x="3" y="4" width="6" height="6" rx="1" />
									<rect x="15" y="14" width="6" height="6" rx="1" />
									<path d="M9 7h3a3 3 0 0 1 3 3v4" />
									<path d="m12 11 3 3 3-3" />
								</template>
								<template v-else>
									<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />
								</template>
							</svg>
						</div>
						<h3 class="m-0 text-3xl font-extrabold leading-tight tracking-normal text-slate-950 dark:text-white">{{ benefit.title }}</h3>
						<p class="m-0 mt-6 text-lg font-medium leading-8 text-slate-600 dark:text-white/60">{{ benefit.text }}</p>
				</div>
			</div>
			</div>
		</section>
	</div>
</template>
