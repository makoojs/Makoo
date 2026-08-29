import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitepress';

type VitePressConfig = Parameters<typeof defineConfig>[0];
type VitePlugin = NonNullable<NonNullable<VitePressConfig['vite']>['plugins']>[number];

const tailwindPlugin = tailwindcss() as unknown as VitePlugin;

const enGuideSidebar = [
	{
		text: 'Guide',
		items: [
			{ text: 'Introduction', link: '/docs/' },
			{ text: 'Getting Started', link: '/docs/getting-started' },
			{ text: 'Core Concepts', link: '/docs/concepts' },
			{ text: 'Configuration', link: '/docs/configuration' },
			{ text: 'HMR Behavior', link: '/docs/hmr' },
			{ text: 'Recipes', link: '/docs/recipes' }
		]
	}
];

const zhGuideSidebar = [
	{
		text: '指南',
		items: [
			{ text: '介绍', link: '/zh/docs/' },
			{ text: '快速开始', link: '/zh/docs/getting-started' },
			{ text: '核心概念', link: '/zh/docs/concepts' },
			{ text: '配置', link: '/zh/docs/configuration' },
			{ text: 'HMR 行为', link: '/zh/docs/hmr' },
			{ text: '实践示例', link: '/zh/docs/recipes' }
		]
	}
];

const enApiSidebar = [
	{
		text: 'API Reference',
		items: [
			{ text: 'Core API', link: '/api/core' },
			{ text: 'CLI API', link: '/api/cli' },
			{ text: 'Vue API', link: '/api/vue' },
			{ text: 'React API', link: '/api/react' }
		]
	}
];

const zhApiSidebar = [
	{
		text: 'API 参考',
		items: [
			{ text: '核心 API', link: '/zh/api/core' },
			{ text: 'CLI API', link: '/zh/api/cli' },
			{ text: 'Vue API', link: '/zh/api/vue' },
			{ text: 'React API', link: '/zh/api/react' }
		]
	}
];

export default defineConfig({
	title: 'Makoo',
	description: 'A userscript development framework for component-driven injection apps.',
	lang: 'en-US',
	base: process.env.VITEPRESS_BASE ?? '/',
	cleanUrls: true,
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
		['link', { rel: 'icon', href: '/makoo-icon.png', type: 'image/png' }]
	],
	themeConfig: {
		logo: '/makoo-icon.png',
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
