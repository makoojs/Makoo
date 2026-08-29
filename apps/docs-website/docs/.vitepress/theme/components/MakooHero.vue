<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, withBase } from 'vitepress';

type Locale = 'en' | 'zh';
type LifecycleState = 'waiting' | 'mounted' | 'recovery';
type CopyState = 'idle' | 'loading' | 'success' | 'error';

const route = useRoute();
const locale = computed<Locale>(() => (route.path.startsWith('/zh/') ? 'zh' : 'en'));
const logoSrc = withBase('/makoo-icon.png');
const command = 'pnpm dlx @makoojs/create-makoo';
const copyState = ref<CopyState>('idle');
const lifecycleSequence: LifecycleState[] = ['waiting', 'mounted', 'recovery'];
const lifecycleState = ref<LifecycleState>('waiting');
let copyResetTimer: number | undefined;
let lifecycleTimer: number | undefined;
let lifecycleObserver: IntersectionObserver | undefined;
let lifecycleInView = false;
let motionQuery: MediaQueryList | undefined;
let revealObserver: IntersectionObserver | undefined;

const messages = {
	en: {
		eyebrow: 'Component-driven userscript framework', title: 'Bring reliable components into any webpage.',
		lead: 'Makoo organizes injection tasks, DOM waiting, and page lifecycles for Vue and React userscripts, keeping complex scripts clear, composable, and maintainable.',
		getStarted: 'Get started', github: 'View source', copy: 'Copy', copying: 'Copying', copied: 'Copied', copyError: 'Copy failed',
		copySuccessStatus: 'The create command was copied to your clipboard.', copyErrorStatus: 'Copy failed. Select the command manually.',
		runtimeDescription: 'Makoo waits for the host target, matches the component adapter, mounts the component, and keeps the task alive.',
		hostPanelLabel: 'Host page DOM', mountPanelLabel: 'Injected component',
		runtimeEvents: ['Waiting for the target node', 'Matching the component adapter', 'Mounting and keeping alive'],
		adapterAriaLabel: 'Adapter protocol', adapterHub: ['adapter', 'protocol'],
		lifecycleHostKind: 'Page location', lifecycleHostName: 'Header region',
		lifecycleInstanceKind: 'UI component', lifecycleInstanceName: 'Header badge',
		lifecycleProcessLabel: 'Current process',
		developersTitle: 'From task declaration to lifecycle management.', developersLead: 'Declare injections, wait for DOM, mount components, and recover after page redraws.',
		capabilities: [
			['Declarative injection tasks', 'Task ID, target selector, component, and alive strategy stay in one declaration, so the injection boundary is clear at a glance.'],
			['Aware of the real page DOM', 'Makoo waits for the real host node instead of guessing load timing, then sends the component to the correct place.'],
			['Framework-neutral component protocol', 'Core only depends on matches(), mount(), and unmount(), allowing more frameworks to connect later.'],
			['Lifecycle recovery after redraws', 'Waiting, mounting, and recovery have explicit states. Switch the state to see how Makoo reinjects after a host redraw.']
		],
		stateLabel: 'Select task state', statePanelLabel: 'Header badge · Current state',
		states: {
			waiting: { button: 'Waiting', status: 'WAITING', title: 'Waiting for the target node', copy: 'The target is not present yet. The task waits quietly and continues automatically when the page is ready.', host: 'Not present', observer: 'Waiting', instance: 'Not mounted', trace: 'Waiting for the page', events: [['Find target region', 'The page is not ready'], ['Keep waiting', 'Do not mount early'], ['Continue automatically', 'Resume when target appears']] },
			mounted: { button: 'Mounted', status: 'MOUNTED', title: 'Component mounted and stable', copy: 'The component is on the page, and Makoo keeps watching for changes to its host region.', host: 'Connected', observer: 'Watching', instance: 'Visible', trace: 'Page state is stable', events: [['Find page region', 'The host region is ready'], ['Show component', 'The UI entered the page'], ['Keep watching', 'Observe later updates']] },
			recovery: { button: 'Recovery', status: 'RECOVERING', title: 'Restoring the component', copy: 'After the host region is replaced, Makoo clears stale state and restores the component when the new node appears.', host: 'Replaced', observer: 'Preparing recovery', instance: 'Recreating', trace: 'Recover after page redraw', events: [['Detect replacement', 'The old region disappeared'], ['Clear old state', 'Dispose the stale instance'], ['Mount again', 'Restore on the new node']] }
		},
		modulesEyebrow: 'Multi-module organization', modulesTitle: 'More features. The structure stays clear.',
		modulesLead: 'Split page components, interaction listeners, and helpers into independent modules, then let one runtime start and clean them up together.',
		stageTitle: 'Example project · Three feature modules',
		columns: { source: ['01', 'Feature modules', 'Each feature keeps its own UI and interactions'], runtime: ['02', 'Run together', 'Makoo starts these independent tasks'], page: ['03', 'Enter the page', 'Each module owns a different region or action'] },
		modules: [['toolbar', 'Page toolbar', 'UI and styles', 'UI module', 'Visible', 'Pinned to the header'], ['shortcut', 'Keyboard shortcuts', 'Page interactions', 'Listener task', 'Listening', 'Press K to open'], ['settings', 'Settings panel', 'Panel and state', 'UI module', 'On demand', 'Expands when needed']],
		principles: [['01 · Organize locally', 'Feature boundaries do not mix', 'Components, styles, and interactions stay inside their feature modules.'], ['02 · Run together', 'One app starts everything', 'Page components and listener tasks can participate in the same runtime.'], ['03 · Join on demand', 'Enable features by page', 'Each feature decides whether it should appear on the current page.']],
		footer: 'Component-driven userscript framework', docs: 'Docs', api: 'API'
	},
	zh: {
		eyebrow: '组件化 userscript 开发框架', title: '让组件可靠地进入任何网页。',
		lead: 'Makoo 为 Vue 与 React 用户脚本组织注入任务、DOM 等待和页面生命周期，让逐渐复杂的脚本仍然保持清楚、可组合、可维护。',
		getStarted: '开始使用', github: '查看源代码', copy: '复制', copying: '正在复制', copied: '已复制', copyError: '复制失败',
		copySuccessStatus: '创建命令已复制到剪贴板。', copyErrorStatus: '复制失败，请手动选择命令。',
		runtimeDescription: 'Makoo 等待宿主页面目标节点，匹配组件 adapter，完成挂载并保持任务存活。',
		hostPanelLabel: '宿主页面 DOM', mountPanelLabel: '组件注入结果',
		runtimeEvents: ['等待目标节点', '匹配组件 adapter', '挂载并保持 alive'],
		adapterAriaLabel: 'adapter 通用协议', adapterHub: ['adapter', '协议'],
		lifecycleHostKind: '页面位置', lifecycleHostName: '页头区域',
		lifecycleInstanceKind: '界面组件', lifecycleInstanceName: '顶部徽标',
		lifecycleProcessLabel: '当前过程',
		developersTitle: '从任务声明到生命周期管理。', developersLead: '声明注入、等待 DOM、挂载组件，并在页面重绘后恢复运行。',
		capabilities: [
			['声明式注入任务', '任务 ID、目标选择器、组件与存活策略集中在同一个声明中，注入边界从代码第一眼就清楚。'],
			['感知真实页面 DOM', '无需猜测页面加载时机；Makoo 等待真正的宿主节点出现，再把组件送到正确位置。'],
			['框架无关的组件协议', 'Core 只依赖 matches()、mount() 与 unmount()，后续框架可以继续接入。'],
			['应对页面重绘的生命周期', '等待、挂载和恢复都有明确状态。切换右侧状态，查看宿主节点被替换后 Makoo 如何重新注入。']
		],
		stateLabel: '选择任务状态', statePanelLabel: '顶部徽标 · 当前状态',
		states: {
			waiting: { button: '等待目标', status: '等待目标', title: '正在等待目标节点', copy: '目标还没有出现，任务会安静等待；页面准备好后自动继续。', host: '尚未出现', observer: '正在等待', instance: '尚未挂载', trace: '等待页面准备好', events: [['寻找目标区域', '页面尚未准备好'], ['保持等待', '不会提前显示组件'], ['自动继续', '目标出现后接着运行']] },
			mounted: { button: '已挂载', status: '已挂载', title: '组件已稳定挂载', copy: '组件已经进入页面，Makoo 会持续关注宿主区域是否被页面更新。', host: '连接正常', observer: '持续观察', instance: '正在显示', trace: '页面状态稳定', events: [['找到页面位置', '宿主区域已经可用'], ['显示组件', '界面已经进入网页'], ['继续观察', '留意页面后续更新']] },
			recovery: { button: '恢复中', status: '恢复中', title: '正在恢复组件', copy: '宿主区域被替换后，Makoo 会清理旧状态，并在新节点出现时自动恢复组件。', host: '已被替换', observer: '准备恢复', instance: '重新创建', trace: '页面更新后恢复', events: [['发现区域被替换', '原来的宿主节点已消失'], ['清理旧状态', '释放失效组件实例'], ['重新显示组件', '在新节点上恢复界面']] }
		},
		modulesEyebrow: '多模块组织', modulesTitle: '功能变多，结构依然清楚。',
		modulesLead: '把页面组件、交互监听和辅助功能拆成独立模块，再由同一个运行时统一启动和收尾。',
		stageTitle: '示意项目 · 三个功能模块',
		columns: { source: ['01', '功能模块', '每个功能保留自己的界面与交互'], runtime: ['02', '共同运行', 'Makoo 负责启动这些独立任务'], page: ['03', '进入网页', '不同模块负责不同区域与操作'] },
		modules: [['toolbar', '页面工具栏', '界面与样式', '界面模块', '已显示', '固定在顶部区域'], ['shortcut', '快捷键监听', '页面交互', '监听任务', '监听中', '按下 K 唤起'], ['settings', '设置面板', '面板与状态', '界面模块', '按需出现', '需要时展开']],
		principles: [['01 · 各自组织', '功能边界不混在一起', '组件、样式和交互逻辑留在各自模块中。'], ['02 · 共同运行', '一个应用统一启动', '页面组件和监听任务可以同时参与运行。'], ['03 · 按需参与', '跟随页面分别启用', '不同功能可以根据当前页面决定是否出现。']],
		footer: '组件化 userscript 开发框架', docs: '文档', api: 'API'
	}
} as const;

const content = computed(() => messages[locale.value]);
const docsLink = computed(() => withBase(locale.value === 'zh' ? '/zh/docs/getting-started' : '/docs/getting-started'));
const apiLink = computed(() => withBase(locale.value === 'zh' ? '/zh/api/core' : '/api/core'));
const activeLifecycle = computed(() => content.value.states[lifecycleState.value]);
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

function stopLifecyclePlayback(): void {
	if (!lifecycleTimer) return;
	window.clearInterval(lifecycleTimer);
	lifecycleTimer = undefined;
}

function startLifecyclePlayback(): void {
	if (lifecycleTimer || !lifecycleInView || motionQuery?.matches) return;
	lifecycleTimer = window.setInterval(() => {
		const currentIndex = lifecycleSequence.indexOf(lifecycleState.value);
		lifecycleState.value = lifecycleSequence[(currentIndex + 1) % lifecycleSequence.length];
	}, 3200);
}

function selectLifecycleState(state: LifecycleState): void {
	lifecycleState.value = state;
	stopLifecyclePlayback();
	startLifecyclePlayback();
}

function handleMotionPreference(event: MediaQueryListEvent): void {
	if (!event.matches) {
		startLifecyclePlayback();
		return;
	}
	stopLifecyclePlayback();
	for (const item of document.querySelectorAll<HTMLElement>('.makoo-home-shell .reveal')) item.classList.add('is-visible');
	document.documentElement.classList.remove('motion-ready');
	revealObserver?.disconnect();
}

onMounted(() => {
	motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	motionQuery.addEventListener('change', handleMotionPreference);
	const revealItems = document.querySelectorAll<HTMLElement>('.makoo-home-shell .reveal');
	if ('IntersectionObserver' in window && !motionQuery.matches) {
		document.documentElement.classList.add('motion-ready');
		revealObserver = new IntersectionObserver((entries, observer) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add('is-visible');
				observer.unobserve(entry.target);
			}
		}, { threshold: 0.18 });
		for (const item of revealItems) revealObserver.observe(item);
	} else {
		for (const item of revealItems) item.classList.add('is-visible');
	}

	const lifecycleCard = document.querySelector<HTMLElement>('.makoo-home-shell .lifecycle-card');
	if ('IntersectionObserver' in window && lifecycleCard) {
		lifecycleObserver = new IntersectionObserver((entries) => {
			lifecycleInView = entries.some(entry => entry.isIntersecting);
			if (lifecycleInView) startLifecyclePlayback();
			else stopLifecyclePlayback();
		}, { threshold: 0.35 });
		lifecycleObserver.observe(lifecycleCard);
	} else {
		lifecycleInView = true;
		startLifecyclePlayback();
	}
});

onBeforeUnmount(() => {
	if (copyResetTimer) window.clearTimeout(copyResetTimer);
	stopLifecyclePlayback();
	lifecycleObserver?.disconnect();
	motionQuery?.removeEventListener('change', handleMotionPreference);
	revealObserver?.disconnect();
	document.documentElement.classList.remove('motion-ready');
});
</script>

<template>
	<div class="makoo-home-shell overflow-hidden" data-od-id="makoo-home">
		<section class="hero mx-auto grid w-[min(calc(100%-40px),var(--max))] grid-cols-[minmax(0,.9fr)_minmax(440px,1.1fr)] items-center gap-18 pt-12 pb-19.5" data-od-id="home-hero">
			<div class="hero-copy">
				<img class="hero-mark mb-6.5 h-26 w-26 rounded-6.5 object-cover" :src="logoSrc" alt="" width="104" height="104" />
				<p class="eyebrow mb-3.5 text-[13px] leading-relaxed font-semibold tracking-wide">{{ content.eyebrow }}</p>
				<h1 class="max-w-160 text-[clamp(42px,4.6vw,58px)] leading-snug font-semibold" data-od-id="home-title">{{ content.title }}</h1>
				<p class="hero-lead mt-5.5 max-w-145 text-lg leading-relaxed">{{ content.lead }}</p>
				<div class="hero-actions mt-7.5 flex flex-wrap items-center gap-2.5">
					<a class="primary-link inline-flex min-h-12 items-center justify-center gap-2.25 rounded-xl px-5 text-sm font-semibold tracking-wide no-underline" :href="docsLink">{{ content.getStarted }}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4" /></svg></a>
					<a class="secondary-link inline-flex min-h-12 items-center justify-center gap-2.25 rounded-xl px-4.25 text-sm font-medium tracking-wide no-underline" href="https://github.com/makoojs/Makoo"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.02-1.91-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.75-.1-.26-.45-1.3.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.98c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.71 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" /></svg>{{ content.github }}</a>
				</div>
				<div class="install-command mt-3.5 grid h-13.5 w-[min(100%,500px)] grid-cols-[auto_minmax(0,1fr)_auto] items-stretch overflow-hidden rounded-xl"><span class="command-prompt" aria-hidden="true">$</span><code>{{ command }}</code><button class="copy-command" type="button" :data-copy-state="copyState" :disabled="copyState === 'loading'" @click="copyCommand"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="6" y="6" width="9" height="9" rx="2" /><path d="M4 12H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" /></svg><span>{{ copyLabel }}</span></button><span class="sr-only" role="status" aria-live="polite">{{ copyState === 'success' ? content.copySuccessStatus : copyState === 'error' ? content.copyErrorStatus : '' }}</span></div>
			</div>
			<div class="runtime-visual relative min-h-112.5 overflow-hidden rounded-4.5" :aria-label="content.runtimeDescription">
				<div class="visual-bar relative z-2 flex min-h-14.5 items-center justify-between gap-4.5 px-2.5 pl-4.5"><div class="visual-title flex items-center gap-2.25"><span class="status-dot h-1.75 w-1.75 rounded-full"></span><span>Makoo Runtime</span></div></div>
				<div class="runtime-stage"><div class="browser-panel"><p class="panel-label">{{ content.hostPanelLabel }}</p><div class="dom-tree" aria-hidden="true"><div class="dom-line">&lt;body&gt;</div><div class="dom-line">&lt;main&gt;</div><div class="dom-line target">#target detected</div><div class="dom-line">&lt;/main&gt;</div></div></div><div class="pipeline" aria-hidden="true"><span class="pipeline-label">adapter.mount()</span></div><div class="mount-panel"><p class="panel-label">{{ content.mountPanelLabel }}</p><div class="component-shell" aria-hidden="true"><div class="component-card"><div class="component-head"></div><div class="component-copy"></div><div class="component-copy short"></div><div class="component-action"></div></div></div></div></div>
				<div class="event-log" aria-hidden="true"><div v-for="event in content.runtimeEvents" :key="event" class="log-item"><span class="log-mark"></span><span>{{ event }}</span></div></div>
			</div>
		</section>

		<section id="developers" class="section relative isolate w-full overflow-hidden pb-28" data-od-id="developers-section">
			<div class="section-heading mx-auto grid w-[min(calc(100%-40px),1380px)] place-items-start pt-24 pb-13 text-left"><div class="grid justify-items-start gap-4"><h2>{{ content.developersTitle }}</h2><p class="section-lead">{{ content.developersLead }}</p></div></div>
			<div class="capability-grid">
				<article class="capability-card task-card reveal"><div class="capability-copy"><h3>{{ content.capabilities[0][0] }}</h3><p>{{ content.capabilities[0][1] }}</p></div><div class="capability-visual code-window"><div class="code-window-bar"><span>headerBadge.ts</span><span>TypeScript</span></div><div class="code-lines"><div class="code-line" data-line="1"><span class="code-key">inject</span>({</div><div class="code-line active" data-line="2">&nbsp;&nbsp;id: <span class="code-value">'header-badge'</span>,</div><div class="code-line active" data-line="3">&nbsp;&nbsp;injectAt: <span class="code-value">'#header'</span>,</div><div class="code-line" data-line="4">&nbsp;&nbsp;artifact: HeaderBadge,</div><div class="code-line" data-line="5">&nbsp;&nbsp;options: { alive: <span class="code-key">true</span> }</div><div class="code-line" data-line="6">});</div></div></div></article>
				<article class="capability-card dom-card reveal"><div class="capability-copy"><h3>{{ content.capabilities[1][0] }}</h3><p>{{ content.capabilities[1][1] }}</p></div><div class="capability-visual target-map" aria-hidden="true"><div class="target-canvas"><div class="target-browser"><span class="target-row one"></span><span class="target-row two"></span><span class="target-row three"></span></div><span class="target-wire"></span><span class="target-node">#header<br />detected</span></div></div></article>
				<article class="capability-card adapter-card reveal"><div class="capability-copy"><h3>{{ content.capabilities[2][0] }}</h3><p>{{ content.capabilities[2][1] }}</p></div><div class="capability-visual adapter-lab" role="img" :aria-label="content.adapterAriaLabel"><span class="adapter-beam matches"></span><span class="adapter-beam mount"></span><span class="adapter-beam unmount"></span><div class="adapter-hub">{{ content.adapterHub[0] }}<br />{{ content.adapterHub[1] }}</div><span class="adapter-method matches">matches()</span><span class="adapter-method mount">mount()</span><span class="adapter-method unmount">unmount()</span></div></article>
				<article class="capability-card lifecycle-card reveal"><div class="capability-copy"><h3>{{ content.capabilities[3][0] }}</h3><p>{{ content.capabilities[3][1] }}</p></div><div class="capability-visual state-demo"><div class="state-controls" role="group" :aria-label="content.stateLabel"><button v-for="state in lifecycleSequence" :key="state" class="state-chip" type="button" :aria-pressed="lifecycleState === state" @click="selectLifecycleState(state)"><span class="state-chip-dot"></span>{{ content.states[state].button }}</button></div><div class="state-panel" :data-state="lifecycleState"><div class="state-panel-head"><div class="state-panel-title"><span>{{ content.statePanelLabel }}</span><strong>{{ activeLifecycle.title }}</strong></div><span class="state-status">{{ activeLifecycle.status }}</span></div><div class="runtime-topology" aria-hidden="true"><div class="life-node host-node"><span class="node-kind">{{ content.lifecycleHostKind }}</span><strong>{{ content.lifecycleHostName }}</strong><span class="state-value">{{ activeLifecycle.host }}</span></div><div class="observer-bridge"><span class="observer-pulse"></span><span class="state-value">{{ activeLifecycle.observer }}</span></div><div class="life-node instance-node"><span class="node-kind">{{ content.lifecycleInstanceKind }}</span><strong>{{ content.lifecycleInstanceName }}</strong><span class="state-value">{{ activeLifecycle.instance }}</span></div></div><div class="state-trace"><div class="trace-head"><span>{{ content.lifecycleProcessLabel }}</span><span>{{ activeLifecycle.trace }}</span></div><ol class="trace-list"><li v-for="(event, index) in activeLifecycle.events" :key="event[0]" class="trace-item"><span class="trace-index">{{ String(index + 1).padStart(2, '0') }}</span><span class="trace-copy"><strong>{{ event[0] }}</strong><small>{{ event[1] }}</small></span></li></ol></div><p class="state-explanation" aria-live="polite">{{ activeLifecycle.copy }}</p></div></div></article>
			</div>
		</section>

		<section id="why-makoo" class="module-section" data-od-id="module-organization-section">
			<div class="module-heading"><div><p class="eyebrow">{{ content.modulesEyebrow }}</p><h2>{{ content.modulesTitle }}</h2></div><p class="section-lead">{{ content.modulesLead }}</p></div>
			<div class="module-stage reveal"><div class="module-stage-bar"><span class="module-stage-title">{{ content.stageTitle }}</span></div><div class="module-map">
				<div class="module-column module-source"><div class="module-column-head"><span>{{ content.columns.source[0] }}</span><strong>{{ content.columns.source[1] }}</strong><small>{{ content.columns.source[2] }}</small></div><div class="module-list"><div v-for="(item, index) in content.modules" :key="item[0]" class="module-source-item module-cycle" :data-module="item[0]"><span class="module-source-icon"><svg v-if="index === 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v5H4zM7 15h10M9 19h6" /></svg><svg v-else-if="index === 1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h2M7 14h5M15 14h2" /></svg><svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg></span><span class="module-source-copy"><strong>{{ item[1] }}</strong><small>{{ item[2] }}</small></span></div></div></div>
				<div class="module-column module-runtime"><div class="module-column-head"><span>{{ content.columns.runtime[0] }}</span><strong>{{ content.columns.runtime[1] }}</strong><small>{{ content.columns.runtime[2] }}</small></div><div class="module-list"><div v-for="item in content.modules" :key="item[0]" class="runtime-task module-cycle" :data-module="item[0]"><span><strong>{{ item[1] }}</strong><small>{{ item[3] }}</small></span><span class="task-state">{{ item[4] }}</span></div></div></div>
				<div class="module-column module-page"><div class="module-column-head"><span>{{ content.columns.page[0] }}</span><strong>{{ content.columns.page[1] }}</strong><small>{{ content.columns.page[2] }}</small></div><div class="page-shell" aria-hidden="true"><div class="page-chrome"><i></i><i></i><i></i><span class="page-address"></span></div><div class="page-canvas"><div class="page-nav-line"></div><div class="page-hero-line"></div><div class="page-copy-line"></div><div class="page-region region-toolbar module-cycle" data-module="toolbar"><strong>{{ content.modules[0][1] }}</strong><small>{{ content.modules[0][5] }}</small></div><div class="page-region region-shortcut module-cycle" data-module="shortcut"><strong>{{ content.modules[1][1] }}</strong><small>{{ content.modules[1][5] }}</small></div><div class="page-region region-settings module-cycle" data-module="settings"><strong>{{ content.modules[2][1] }}</strong><small>{{ content.modules[2][5] }}</small></div></div></div></div>
			</div><div class="module-principles"><div v-for="principle in content.principles" :key="principle[0]" class="module-principle"><span>{{ principle[0] }}</span><strong>{{ principle[1] }}</strong><p>{{ principle[2] }}</p></div></div></div>
		</section>
		<footer class="site-footer"><div class="footer-brand"><img :src="logoSrc" alt="" /><span>Makoo · {{ content.footer }}</span></div><div class="footer-links"><a :href="docsLink">{{ content.docs }}</a><a :href="apiLink">{{ content.api }}</a><a href="https://github.com/makoojs/Makoo">GitHub</a></div></footer>
	</div>
</template>
