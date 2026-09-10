<script setup lang="ts">
import { computed, ref } from 'vue';
import { withBase } from 'vitepress';

const props = defineProps<{ locale: 'en' | 'zh' }>();
const activeFeature = ref(0);
const framework = ref<'Vue' | 'React'>('Vue');
const messages = {
	zh: {
		intro: '从一个小功能，', introAccent: '写成顺手的工具。',
		introLead: '从一个小小的页面增强，到有组件、有交互的完整工具。Makoo 为你的想法提供清楚的结构。',
		features: [
			['组件化开发', '用熟悉的 Vue 和 React，把界面带进你正在使用的网页。'],
			['声明式注入', '组件、目标、运行策略，在一个声明里各就其位。'],
			['感知页面变化', '等待异步内容，在宿主节点替换后恢复组件。'],
			['统一事件管理', '让页面交互也成为可以启停、可以清理的任务。'],
			['TypeScript 支持', '从任务声明到组件上下文，让类型贯穿开发过程。'],
			['完整开发工具链', '项目创建、开发调试、构建预览，衔接在一起。']
		],
		spotlight: '写组件，', spotlightAccent: '也照顾页面的变化。',
		products: [
			{ name: 'Runtime', tag: '为动态网页而生', title: '页面会变，\n组件也需要照应。', description: '等待目标、挂载组件、处理宿主替换。让页面里的每项任务都有自己的生命周期。', points: ['异步 DOM 等待', '组件存活与恢复', '统一销毁与清理'], link: '/docs/lifecycle', action: '认识 Runtime', visual: ['等待', '挂载', '恢复'] },
			{ name: 'Devtools', tag: '让开发状态看得见', title: '少一些猜测。\n多一些掌握。', description: '在终端里查看连接、任务与开发日志。保持熟悉的 Vite 开发体验，更清楚脚本正在做什么。', points: ['Runtime 连接', '任务状态查看', '开发日志'], link: '/docs/development', action: '探索开发工具', visual: ['连接', '任务', '日志'] },
			{ name: 'Toolchain', tag: '从想法到脚本', title: '顺畅地开始。\n从容地交付。', description: '选好框架，创建项目。在 Vite 与 Monkey 的支持下，把页面功能构建成可安装的 userscript。', points: ['Vue / React 模板', 'Vite 开发服务', '构建与预览'], link: '/docs/build', action: '了解工具链', visual: ['创建', '开发', '构建'] }
		],
		frameworkLabel: '使用你熟悉的技术', frameworkTitle: '你的框架。\n更大的用武之地。', frameworkLead: '组件继续用 Vue 或 React 编写。Makoo 通过 Adapter 连接框架与网页，让现有的组件经验继续发挥作用。', frameworkLink: '了解框架适配',
		cliLabel: 'Makoo CLI · 开发终端', cliTitle: '常用的开发操作，\n按一下就好。', cliLead: '安装开发脚本、查看日志、重启服务。启用 makooDev()，在终端按下一个键，让常用操作跟上你的思路。', cliLink: '认识开发终端', cliKeys: ['安装脚本', '查看日志', '重启服务'],
		tasksLabel: 'Runtime · 任务查看', tasksTitle: '回到终端，\n看看任务怎么样了。', tasksLead: '哪个任务已经激活，哪个还在等待？在终端查看状态、类型和目标，在多个 Runtime 之间切换。页面里的运行情况，有迹可循。', tasksLink: '了解任务查看', tasksCaption: '任务状态，随页面更新',
		codeLabel: '简洁，从入口开始', codeTitle: '写好组件，\n再选个位置。', codeLead: '把写好的组件交给 Makoo，剩下的从这里开始。', codeLink: '开始构建',
		endLabel: '开源 · MIT License', endTitle: '从你想改的\n那个小地方开始。', endLead: '给常用的网页，添一点自己的想法。', start: '开始使用', github: '在 GitHub 上探索',
		resources: [['组件注入', '/docs/injection'], ['事件监听', '/docs/listeners'], ['完整案例', '/docs/recipes'], ['API 参考', '/api/core']]
	},
	en: {
		intro: 'Start with a small feature.', introAccent: 'Make it a handy tool.',
		introLead: 'From a small page enhancement to a complete tool with components and interactions. Give your ideas a clear structure with Makoo.',
		features: [
			['Component-driven', 'Bring familiar Vue and React components to the pages you already use.'],
			['Declarative by design', 'A component, a target, and a strategy. Everything in its place.'],
			['Aware of changing pages', 'Wait for asynchronous content and recover when host nodes are replaced.'],
			['Events with a lifecycle', 'Turn page interactions into tasks you can start, stop, and clean up.'],
			['Built with TypeScript', 'Carry types from task declarations through to component context.'],
			['A connected toolchain', 'Project creation, development, builds, and previews that work together.']
		],
		spotlight: 'Write components.', spotlightAccent: 'Account for changing pages.',
		products: [
			{ name: 'Runtime', tag: 'Made for dynamic pages', title: 'Pages change.\nComponents need care, too.', description: 'Wait for targets, mount components, and handle host replacements. Give every task on the page a lifecycle of its own.', points: ['Asynchronous DOM waiting', 'Component recovery', 'Coordinated cleanup'], link: '/docs/lifecycle', action: 'Meet the Runtime', visual: ['Wait', 'Mount', 'Recover'] },
			{ name: 'Devtools', tag: 'A clearer view of development', title: 'Less guessing.\nMore understanding.', description: 'Inspect connections, tasks, and development logs in your terminal. Keep the Vite workflow you know, with a clearer view of your script.', points: ['Runtime connections', 'Task inspection', 'Development logs'], link: '/docs/development', action: 'Explore devtools', visual: ['Connect', 'Tasks', 'Logs'] },
			{ name: 'Toolchain', tag: 'From an idea to a userscript', title: 'Start with ease.\nShip with confidence.', description: 'Pick a framework and create a project. Build your page features into an installable userscript with Vite and Monkey.', points: ['Vue / React templates', 'Vite development server', 'Build and preview'], link: '/docs/build', action: 'Explore the toolchain', visual: ['Create', 'Develop', 'Build'] }
		],
		frameworkLabel: 'Built for the tools you know', frameworkTitle: 'Your framework.\nMore places to use it.', frameworkLead: 'Keep writing components in Vue or React. Makoo connects frameworks to pages through Adapters, putting your existing skills to work.', frameworkLink: 'Explore Adapters',
		cliLabel: 'Makoo CLI · Development terminal', cliTitle: 'Everyday dev actions.\nA keypress away.', cliLead: 'Install your development script, read logs, and restart the server. Enable makooDev() to keep everyday actions a keystroke away.', cliLink: 'Meet the dev terminal', cliKeys: ['Install script', 'View logs', 'Restart server'],
		tasksLabel: 'Runtime · Task inspection', tasksTitle: 'Back in the terminal.\nSee how your tasks are doing.', tasksLead: 'What is active? What is still waiting? Inspect task status, kind, and target in your terminal, and switch between connected Runtimes to see what is happening.', tasksLink: 'Explore task inspection', tasksCaption: 'Task states, updated with the page',
		codeLabel: 'Simple from the start', codeTitle: 'Write a component.\nPick a place for it.', codeLead: 'Bring your component. Let Makoo take it from here.', codeLink: 'Start building',
		endLabel: 'Open source · MIT License', endTitle: 'Start with one small thing\nyou want to change.', endLead: 'Bring a little of your own thinking to the pages you use.', start: 'Get started', github: 'Explore on GitHub',
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
