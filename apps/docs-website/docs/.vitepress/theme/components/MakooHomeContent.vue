<script setup lang="ts">
import { computed, ref } from 'vue';
import { withBase } from 'vitepress';

const props = defineProps<{ locale: 'en' | 'zh' }>();
const activeFeature = ref(0);
const framework = ref<'Vue' | 'React'>('Vue');
const messages = {
	zh: {
		intro: '组件化开发', introAccent: '结构化管理',
		introLead: '为复杂用户脚本提供组件注入与运行时管理能力',
		features: [
			['组件化开发', '使用 Vue 或 React 为网页构建交互界面'],
			['声明式注入', '通过声明配置组件与目标节点及运行策略'],
			['页面变化处理', '等待异步节点并在宿主替换后重新挂载组件'],
			['统一事件管理', '通过任务统一管理事件监听的启停与清理'],
			['TypeScript 支持', '为任务声明与组件上下文提供类型支持'],
			['完整开发工具链', '支持项目创建与开发调试及构建预览']
		],
		spotlight: '组件注入', spotlightAccent: '适配动态网页',
		products: [
			{ name: 'Runtime', tag: '运行时管理', title: '目标节点等待\n组件挂载与恢复', description: '管理组件注入与任务生命周期并处理宿主节点替换', points: ['异步 DOM 等待', '组件挂载与恢复', '统一销毁与清理'], link: '/docs/lifecycle', action: '了解 Runtime', visual: ['等待', '挂载', '恢复'] },
			{ name: 'Devtools', tag: '开发状态查看', title: 'Runtime 连接\n任务状态与日志', description: '在 Vite 开发流程中通过终端查看脚本运行状态', points: ['Runtime 连接', '任务状态查看', '开发日志'], link: '/docs/development', action: '查看开发工具', visual: ['连接', '任务', '日志'] },
			{ name: 'Toolchain', tag: '用户脚本工具链', title: '创建与开发\n构建与预览', description: '基于 Vite 与 Monkey 构建可安装的 userscript', points: ['Vue 与 React 模板', 'Vite 开发服务', '构建与预览'], link: '/docs/build', action: '了解工具链', visual: ['创建', '开发', '构建'] }
		],
		frameworkLabel: '框架适配', frameworkTitle: '使用 Vue 或 React\n构建网页组件', frameworkLead: '通过 Adapter 挂载组件并统一管理组件生命周期', frameworkLink: '了解框架适配',
		cliLabel: 'Makoo CLI 开发终端', cliTitle: '终端快捷操作', cliLead: '通过快捷键安装开发脚本与查看日志及重启服务', cliLink: '查看开发终端', cliKeys: ['安装脚本', '查看日志', '重启服务'],
		tasksLabel: 'Runtime 任务查看', tasksTitle: '查看任务运行状态', tasksLead: '在终端查看任务类型与目标节点并切换已连接的 Runtime', tasksLink: '了解任务查看', tasksCaption: '任务状态随页面更新',
		codeLabel: '组件注入示例', codeTitle: '声明组件与目标节点', codeLead: '通过 inject 声明注入任务并由 Runtime 执行', codeLink: '开始构建',
		endLabel: '开源 MIT License', endTitle: '开始构建用户脚本', endLead: '使用 Makoo 开发组件化网页功能', start: '开始使用', github: '查看 GitHub',
		resources: [['组件注入', '/docs/injection'], ['事件监听', '/docs/listeners'], ['完整案例', '/docs/recipes'], ['API 参考', '/api/core']]
	},
	en: {
		intro: 'Component-driven development', introAccent: 'Structured management',
		introLead: 'Component injection and runtime management for complex userscripts',
		features: [
			['Component-driven', 'Build page interfaces with Vue or React'],
			['Declarative injection', 'Declare the component target node and run strategy'],
			['Page change handling', 'Wait for async nodes and remount after host replacement'],
			['Unified event management', 'Start stop and clean up listeners as tasks'],
			['TypeScript support', 'Types for task declarations and component context'],
			['Complete toolchain', 'Project creation development debugging and preview']
		],
		spotlight: 'Component injection', spotlightAccent: 'For dynamic pages',
		products: [
			{ name: 'Runtime', tag: 'Runtime management', title: 'Wait for target nodes\nMount and restore components', description: 'Manage injection and task lifecycle and handle host node replacement', points: ['Asynchronous DOM waiting', 'Component mount and restore', 'Unified destroy and cleanup'], link: '/docs/lifecycle', action: 'Learn about Runtime', visual: ['Wait', 'Mount', 'Restore'] },
			{ name: 'Devtools', tag: 'Development inspection', title: 'Runtime connections\nTask status and logs', description: 'Inspect script status in the terminal during the Vite development flow', points: ['Runtime connections', 'Task inspection', 'Development logs'], link: '/docs/development', action: 'View devtools', visual: ['Connect', 'Tasks', 'Logs'] },
			{ name: 'Toolchain', tag: 'Userscript toolchain', title: 'Create and develop\nBuild and preview', description: 'Build installable userscripts with Vite and Monkey', points: ['Vue and React templates', 'Vite development server', 'Build and preview'], link: '/docs/build', action: 'Learn about the toolchain', visual: ['Create', 'Develop', 'Build'] }
		],
		frameworkLabel: 'Framework adapters', frameworkTitle: 'Build page components\nwith Vue or React', frameworkLead: 'Mount components through Adapters and manage their lifecycle', frameworkLink: 'Learn about adapters',
		cliLabel: 'Makoo CLI development terminal', cliTitle: 'Terminal shortcuts', cliLead: 'Install the development script view logs and restart the server with shortcuts', cliLink: 'View the development terminal', cliKeys: ['Install script', 'View logs', 'Restart server'],
		tasksLabel: 'Runtime task inspection', tasksTitle: 'Inspect running tasks', tasksLead: 'View task type and target node in the terminal and switch between connected Runtimes', tasksLink: 'Learn about task inspection', tasksCaption: 'Task status updates with the page',
		codeLabel: 'Injection example', codeTitle: 'Declare a component and target', codeLead: 'Declare an inject task and let the Runtime run it', codeLink: 'Start building',
		endLabel: 'Open source MIT License', endTitle: 'Start building userscripts', endLead: 'Build component-driven page features with Makoo', start: 'Get started', github: 'View GitHub',
		resources: [['Component injection', '/docs/injection'], ['Event listeners', '/docs/listeners'], ['Complete example', '/docs/recipes'], ['API reference', '/api/core']]
	}
} as const;
const content = computed(() => messages[props.locale]);
const product = computed(() => content.value.products[activeFeature.value]);
const icons = [
	'M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
	'M8 4H5v6l-3 2 3 2v6h3M16 4h3v6l3 2-3 2v6h-3M10 12h4',
	'M3 8V3h5M21 16v5h-5M4 12a8 8 0 0 1 14-5l3 1M20 12a8 8 0 0 1-14 5l-3-1',
	'M13 2 4 14h7l-1 8 10-13h-7l1-7Z',
	'M3 4h18v16H3V4ZM6 9h6M9 9v8M17 10c-4-3-5 4-1 3 4 0 2 6-2 3',
	'M4 6h16v12H4V6ZM7 10l2 2-2 2M12 14h5'
];
const source = computed(() => `import { createMakoo, inject } from '@makoojs/core';
import { create${framework.value}Adapter } from '@makoojs/${framework.value.toLowerCase()}';
import Panel from './Panel.${framework.value === 'Vue' ? 'vue' : 'tsx'}';

createMakoo({ adapters: [create${framework.value}Adapter()] }).start([
  inject({ id: 'panel', injectAt: 'body', artifact: Panel })
]);`);
function link(path: string) { return withBase(`${props.locale === 'zh' ? '/zh' : ''}${path}`); }
</script>

<template>
	<div class="home-introduction">
		<section class="intro-section" aria-labelledby="intro-title">
			<header class="intro-heading"><h2 id="intro-title">{{ content.intro }}<br /><span>{{ content.introAccent }}</span></h2><p>{{ content.introLead }}</p></header>
			<div class="feature-collection">
				<article v-for="(feature, index) in content.features" :key="feature[0]" class="intro-feature">
					<div class="feature-symbol" aria-hidden="true"><span class="feature-index">0{{ index + 1 }}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path :d="icons[index]" /></svg></div>
					<h3>{{ feature[0] }}</h3><p>{{ feature[1] }}</p>
				</article>
			</div>
		</section>

		<section class="product-section" aria-labelledby="product-title">
			<header class="intro-heading"><h2 id="product-title">{{ content.spotlight }}<br /><span>{{ content.spotlightAccent }}</span></h2></header>
			<div class="product-tabs" role="tablist" :aria-label="content.spotlight"><button v-for="(item, index) in content.products" :id="`product-tab-${index}`" :key="item.name" type="button" role="tab" :aria-selected="activeFeature === index" :tabindex="activeFeature === index ? 0 : -1" aria-controls="product-panel" @click="activeFeature = index" @keydown.right.prevent="activeFeature = (index + 1) % 3; ($event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button')[(index + 1) % 3]?.focus()" @keydown.left.prevent="activeFeature = (index + 2) % 3; ($event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button')[(index + 2) % 3]?.focus()"><span class="product-tab-mark" aria-hidden="true">{{ ['◈', '⌘', '↗'][index] }}</span>{{ item.name }}</button></div>
			<div id="product-panel" class="product-showcase" role="tabpanel" :aria-labelledby="`product-tab-${activeFeature}`" :data-feature="activeFeature">
				<div class="product-copy"><p class="intro-label">{{ product.tag }}</p><h3>{{ product.title }}</h3><p>{{ product.description }}</p><div class="product-highlights"><span v-for="point in product.points" :key="point"><i aria-hidden="true"></i>{{ point }}</span></div><a class="intro-link" :href="link(product.link)">{{ product.action }} <span aria-hidden="true">↗</span></a></div>
				<div class="product-art" aria-hidden="true">
					<svg v-if="activeFeature === 0" class="runtime-art" viewBox="0 0 480 340" fill="none"><ellipse cx="240" cy="170" rx="176" ry="112" stroke="currentColor" opacity=".16"/><ellipse cx="240" cy="170" rx="176" ry="112" stroke="currentColor" opacity=".18" transform="rotate(-35 240 170)"/><ellipse cx="240" cy="170" rx="176" ry="112" stroke="currentColor" opacity=".18" transform="rotate(35 240 170)"/><path d="M240 74 324 122v96l-84 48-84-48v-96l84-48Z" fill="var(--makoo-bg)" stroke="currentColor" stroke-width="1.5"/><path d="m156 122 84 48 84-48M240 170v96" stroke="currentColor" opacity=".7"/><path d="m197 146 43-25 43 25-43 25-43-25Z" fill="currentColor" opacity=".2"/><circle cx="64" cy="170" r="6" fill="currentColor"/><circle cx="343" cy="79" r="5" fill="currentColor"/><circle cx="343" cy="261" r="5" fill="currentColor"/></svg>
					<svg v-else-if="activeFeature === 1" class="devtools-art" viewBox="0 0 480 340" fill="none"><circle cx="240" cy="170" r="118" stroke="currentColor" opacity=".15"/><circle cx="240" cy="170" r="82" stroke="currentColor" opacity=".2" stroke-dasharray="3 10"/><path d="M42 174h84l30-44 39 94 49-138 45 100 24-38 29 26h96" stroke="currentColor" stroke-width="2"/><circle cx="244" cy="86" r="7" fill="currentColor"/><path d="M66 267h348M66 74h90M324 74h90" stroke="currentColor" opacity=".15"/><path d="M222 270h8m8 0h8m8 0h8" stroke="currentColor" stroke-width="4"/></svg>
					<svg v-else class="toolchain-art" viewBox="0 0 480 340" fill="none"><path d="m56 170 184-106 184 106-184 106L56 170Z" stroke="currentColor" opacity=".15"/><path d="m96 190 144 83 144-83M96 212l144 83 144-83" stroke="currentColor" opacity=".18"/><path d="m142 134 98-56 98 56-98 56-98-56Z" fill="var(--makoo-bg)" stroke="currentColor"/><path d="M142 134v65l98 56 98-56v-65M240 190v65" stroke="currentColor"/><path d="m210 132 30-17 30 17-30 17-30-17Z" fill="currentColor" opacity=".45"/><path d="M240 38v24m-10-10 10 10 10-10" stroke="currentColor" stroke-width="2"/></svg>
					<div class="art-labels"><span v-for="label in product.visual" :key="label">{{ label }}</span></div>
				</div>
			</div>
		</section>

		<section class="framework-section" aria-labelledby="framework-title">
			<div class="framework-art" aria-hidden="true"><div class="framework-bridge"></div><div class="framework-emblem vue-emblem"><svg viewBox="0 0 100 90" fill="none"><path d="M5 8h20l25 43L75 8h20L50 86 5 8Z" fill="currentColor" opacity=".9"/><path d="M25 8h15l10 17L60 8h15L50 51 25 8Z" fill="currentColor" opacity=".4"/></svg><span>Vue</span></div><div class="framework-emblem react-emblem"><svg viewBox="0 0 100 90" fill="none" stroke="currentColor" stroke-width="3"><ellipse cx="50" cy="45" rx="44" ry="17"/><ellipse cx="50" cy="45" rx="44" ry="17" transform="rotate(60 50 45)"/><ellipse cx="50" cy="45" rx="44" ry="17" transform="rotate(120 50 45)"/><circle cx="50" cy="45" r="6" fill="currentColor" stroke="none"/></svg><span>React</span></div></div>
			<div class="framework-copy"><p class="intro-label">{{ content.frameworkLabel }}</p><h2 id="framework-title">{{ content.frameworkTitle }}</h2><p>{{ content.frameworkLead }}</p><a class="intro-link" :href="link('/api/adapters')">{{ content.frameworkLink }} <span aria-hidden="true">↗</span></a></div>
		</section>

		<section class="cli-section" aria-labelledby="cli-title">
			<div class="cli-copy">
				<p class="intro-label">{{ content.cliLabel }}</p>
				<h2 id="cli-title">{{ content.cliTitle }}</h2>
				<p>{{ content.cliLead }}</p>
				<a class="intro-link" :href="link('/docs/development')">{{ content.cliLink }} <span aria-hidden="true">↗</span></a>
			</div>
			<div class="cli-keyboard" aria-hidden="true">
				<div class="cli-command"><span>$</span> makoo dev</div>
				<div class="cli-keys"><div v-for="(key, index) in ['i', 'l', 'r']" :key="key" class="cli-key"><span>{{ key }}</span><small>{{ content.cliKeys[index] }}</small></div></div>
				<div class="cli-keyboard-line"></div>
			</div>
		</section>

		<section class="cli-section cli-tasks-section" aria-labelledby="tasks-title">
			<div class="cli-task-art" aria-hidden="true">
				<svg viewBox="0 0 480 240" fill="none"><path d="M240 28v54M80 146v-34h320v34M240 82v64" stroke="currentColor" stroke-width="1.5" opacity=".25"/><circle cx="240" cy="28" r="7" fill="currentColor"/><circle cx="80" cy="170" r="24" stroke="currentColor" stroke-width="1.5"/><path d="m70 170 7 7 13-14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="240" cy="170" r="24" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 6" opacity=".65"/><circle cx="240" cy="170" r="5" fill="currentColor" opacity=".65"/><circle cx="400" cy="170" r="24" stroke="currentColor" stroke-width="1.5" opacity=".3"/><path d="M394 170h12" stroke="currentColor" stroke-width="2" opacity=".5"/></svg>
				<div class="cli-task-states"><span>active</span><span>pending</span><span>idle</span></div>
				<p>{{ content.tasksCaption }}</p>
			</div>
			<div class="cli-copy">
				<p class="intro-label">{{ content.tasksLabel }}</p>
				<h2 id="tasks-title">{{ content.tasksTitle }}</h2>
				<p>{{ content.tasksLead }}</p>
				<a class="intro-link" :href="link('/docs/development')">{{ content.tasksLink }} <span aria-hidden="true">↗</span></a>
			</div>
		</section>

		<section class="syntax-section" aria-labelledby="syntax-title"><div class="syntax-copy"><p class="intro-label">{{ content.codeLabel }}</p><h2 id="syntax-title">{{ content.codeTitle }}</h2><p>{{ content.codeLead }}</p><a class="intro-link" :href="link('/docs/getting-started')">{{ content.codeLink }} <span aria-hidden="true">↗</span></a></div><div class="syntax-example"><div class="syntax-toolbar"><span>src/main.ts</span><div role="group" aria-label="Framework"><button v-for="name in (['Vue', 'React'] as const)" :key="name" type="button" :aria-pressed="framework === name" @click="framework = name">{{ name }}</button></div></div><pre><code><span v-for="(line, index) in source.split('\n')" :key="index" class="syntax-line" :class="{ 'syntax-import': line.startsWith('import') }"><span class="syntax-number" aria-hidden="true">{{ index + 1 }}</span><span class="syntax-text">{{ line }}{{ '\n' }}</span></span></code></pre></div></section>

		<section class="closing-section" aria-labelledby="closing-title"><p class="intro-label">{{ content.endLabel }}</p><h2 id="closing-title">{{ content.endTitle }}</h2><p>{{ content.endLead }}</p><div class="closing-actions"><a class="primary-link" :href="link('/docs/getting-started')">{{ content.start }} <span aria-hidden="true">↗</span></a><a class="intro-link" href="https://github.com/makoojs/Makoo">{{ content.github }} <span aria-hidden="true">↗</span></a></div><nav class="intro-resources" :aria-label="content.start"><a v-for="item in content.resources" :key="item[0]" :href="link(item[1])">{{ item[0] }} <span aria-hidden="true">↗</span></a></nav></section>
	</div>
</template>
