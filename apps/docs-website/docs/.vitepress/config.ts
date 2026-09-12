import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitepress';

type VitePressConfig = Parameters<typeof defineConfig>[0];
type VitePlugin = NonNullable<NonNullable<VitePressConfig['vite']>['plugins']>[number];

const tailwindPlugin = tailwindcss() as unknown as VitePlugin;
const base = process.env.VITEPRESS_BASE ?? '/';

const enGuideSidebar = [
	{
		text: 'Getting Started',
		items: [
			{ text: 'Introduction', link: '/docs/' },
			{ text: 'Quick Start', link: '/docs/getting-started' },
			{ text: 'Manual Installation', link: '/docs/installation' },
			{ text: 'Core Concepts', link: '/docs/concepts' }
		]
	},
	{
		text: 'Guides',
		items: [
			{ text: 'Component Injection', link: '/docs/injection' },
			{ text: 'Event Listeners', link: '/docs/listeners' },
			{ text: 'Lifecycle and Cleanup', link: '/docs/lifecycle' },
			{ text: 'Configuration', link: '/docs/configuration' },
			{ text: 'Case Study: Element Picker', link: '/docs/recipes' }
		]
	},
	{
		text: 'Development and Release',
		items: [
			{ text: 'Local Development', link: '/docs/development' },
			{ text: 'Hot Updates and Cleanup', link: '/docs/hmr' },
			{ text: 'Build and Preview', link: '/docs/build' },
			{ text: 'Troubleshooting', link: '/docs/troubleshooting' }
		]
	}
];

const enApiSidebar = [
	{
		text: 'Core',
		items: [
			{ text: 'Overview', link: '/api/core' },
			{ text: 'Runtime and Tasks', link: '/api/runtime' },
			{ text: 'Events and State', link: '/api/observation' },
			{ text: 'Adapters and Context', link: '/api/adapters' },
			{ text: 'DOM, Logging and Errors', link: '/api/utilities' }
		]
	},
	{
		text: 'Toolchain',
		items: [
			{ text: 'CLI Commands', link: '/api/cli' },
			{ text: 'Vite Plugins', link: '/api/vite' }
		]
	},
	{
		text: 'Frameworks and Browser',
		items: [
			{ text: 'Vue', link: '/api/vue' },
			{ text: 'React', link: '/api/react' },
			{ text: 'Userscript APIs', link: '/api/monkey' }
		]
	}
];

const zhGuideSidebar = [
	{
		text: '开始使用',
		items: [
			{ text: '介绍', link: '/zh/docs/' },
			{ text: '快速开始', link: '/zh/docs/getting-started' },
			{ text: '手动接入', link: '/zh/docs/installation' },
			{ text: '核心概念', link: '/zh/docs/concepts' }
		]
	},
	{
		text: '功能指南',
		items: [
			{ text: '组件注入', link: '/zh/docs/injection' },
			{ text: '事件监听', link: '/zh/docs/listeners' },
			{ text: '生命周期与清理', link: '/zh/docs/lifecycle' },
			{ text: '项目配置', link: '/zh/docs/configuration' },
			{ text: '案例：元素选择器', link: '/zh/docs/recipes' }
		]
	},
	{
		text: '开发与发布',
		items: [
			{ text: '本地开发', link: '/zh/docs/development' },
			{ text: '热更新与清理', link: '/zh/docs/hmr' },
			{ text: '构建与预览', link: '/zh/docs/build' },
			{ text: '常见问题', link: '/zh/docs/troubleshooting' }
		]
	}
];

const zhApiSidebar = [
	{
		text: 'Core',
		items: [
			{ text: '总览', link: '/zh/api/core' },
			{ text: 'Runtime 与任务', link: '/zh/api/runtime' },
			{ text: '事件与状态', link: '/zh/api/observation' },
			{ text: 'Adapter 与 Context', link: '/zh/api/adapters' },
			{ text: 'DOM、日志与错误', link: '/zh/api/utilities' }
		]
	},
	{
		text: '工具链',
		items: [
			{ text: 'CLI 命令', link: '/zh/api/cli' },
			{ text: 'Vite 插件', link: '/zh/api/vite' }
		]
	},
	{
		text: '框架与浏览器',
		items: [
			{ text: 'Vue', link: '/zh/api/vue' },
			{ text: 'React', link: '/zh/api/react' },
			{ text: 'Userscript API', link: '/zh/api/monkey' }
		]
	}
];

export default defineConfig({
	title: 'Makoo',
	description: 'A userscript development framework for component-driven injection apps.',
	lang: 'en-US',
	base,
	cleanUrls: true,
	appearance: false,
	markdown: { theme: 'github-dark' },
	locales: {
		root: {
			label: 'English',
			lang: 'en-US',
			title: 'Makoo',
			description: 'A userscript development framework for component-driven injection apps.',
			themeConfig: {
				nav: [
					{ text: 'Docs', link: '/docs/' },
					{ text: 'API', link: '/api/core' }
				],
				sidebar: {
					'/docs/': enGuideSidebar,
					'/api/': enApiSidebar
				}
			}
		},
		zh: {
			label: '简体中文',
			lang: 'zh-CN',
			link: '/zh/',
			title: 'Makoo',
			description: '用于构建组件化用户脚本的开发框架。',
			themeConfig: {
				nav: [
					{ text: '文档', link: '/zh/docs/' },
					{ text: 'API', link: '/zh/api/core' }
				],
				sidebar: {
					'/zh/docs/': zhGuideSidebar,
					'/zh/api/': zhApiSidebar
				}
			}
		}
	},
	head: [
		['script', {}, `document.documentElement.classList.add('dark')`],
		['link', { rel: 'icon', href: `${base}favicon.ico`, sizes: '16x16 32x32 48x48' }],
		['link', { rel: 'icon', href: `${base}makoo-icon.svg`, type: 'image/svg+xml' }],
		['link', { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png` }]
	],
	themeConfig: {
		logo: { src: '/makoo-icon.svg', alt: 'Makoo' },
		siteTitle: 'Makoo',
		search: {
			provider: 'local'
		},
		socialLinks: [{ icon: 'github', link: 'https://github.com/makoojs/Makoo' }]
	},
	vite: {
		plugins: [tailwindPlugin]
	}
});
