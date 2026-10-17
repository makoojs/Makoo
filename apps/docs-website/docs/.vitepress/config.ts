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
			{ text: 'Tutorial: A Toggleable Tool Panel', link: '/docs/tutorial' }
		]
	},
	{
		text: 'How-to Guides',
		items: [
			{ text: 'Add Makoo to an Existing Project', link: '/docs/installation' },
			{ text: 'Mount Components', link: '/docs/injection' },
			{ text: 'Listen to Page Events', link: '/docs/listeners' },
			{ text: 'Control Injections and Read Status', link: '/docs/control' },
			{ text: 'Handle Node Replacement', link: '/docs/reinject' },
			{ text: 'Project Configuration', link: '/docs/configuration' },
			{ text: 'Local Development', link: '/docs/development' },
			{ text: 'Build and Preview', link: '/docs/build' },
			{ text: 'Troubleshooting', link: '/docs/troubleshooting' }
		]
	},
	{
		text: 'Explanation',
		items: [
			{ text: 'Core Concepts', link: '/docs/concepts' },
			{ text: 'Injection Lifecycle', link: '/docs/lifecycle' },
			{ text: 'Error Categories and Handling', link: '/docs/errors' },
			{ text: 'Hot Updates', link: '/docs/hmr' }
		]
	}
];

const enApiSidebar = [
	{
		text: 'Core',
		items: [
			{ text: 'Overview', link: '/api/core' },
			{ text: 'Core Instance', link: '/api/instance' },
			{ text: 'Declarations', link: '/api/declarations' },
			{ text: 'Commands and Status', link: '/api/status' },
			{ text: 'Adapter Contract', link: '/api/adapters' },
			{ text: 'Errors and Error Codes', link: '/api/errors' }
		]
	},
	{
		text: 'Frameworks',
		items: [
			{ text: 'Vue', link: '/api/vue' },
			{ text: 'React', link: '/api/react' }
		]
	},
	{
		text: 'Toolchain',
		items: [
			{ text: 'CLI Commands', link: '/api/cli' },
			{ text: 'Vite Plugins', link: '/api/vite' },
			{ text: 'Userscript API', link: '/api/monkey' }
		]
	}
];

const zhGuideSidebar = [
	{
		text: '开始',
		items: [
			{ text: '介绍', link: '/zh/docs/' },
			{ text: '快速开始', link: '/zh/docs/getting-started' },
			{ text: '教程：可开关的工具面板', link: '/zh/docs/tutorial' }
		]
	},
	{
		text: '操作指南',
		items: [
			{ text: '接入已有项目', link: '/zh/docs/installation' },
			{ text: '挂载组件', link: '/zh/docs/injection' },
			{ text: '监听页面事件', link: '/zh/docs/listeners' },
			{ text: '控制注入与读取状态', link: '/zh/docs/control' },
			{ text: '应对节点替换', link: '/zh/docs/reinject' },
			{ text: '项目配置', link: '/zh/docs/configuration' },
			{ text: '本地开发', link: '/zh/docs/development' },
			{ text: '构建与预览', link: '/zh/docs/build' },
			{ text: '常见问题', link: '/zh/docs/troubleshooting' }
		]
	},
	{
		text: '原理',
		items: [
			{ text: '核心概念', link: '/zh/docs/concepts' },
			{ text: '注入的生命周期', link: '/zh/docs/lifecycle' },
			{ text: '错误的分类与处置', link: '/zh/docs/errors' },
			{ text: '热更新', link: '/zh/docs/hmr' }
		]
	}
];

const zhApiSidebar = [
	{
		text: 'Core',
		items: [
			{ text: '总览', link: '/zh/api/core' },
			{ text: 'Core 实例', link: '/zh/api/instance' },
			{ text: '声明', link: '/zh/api/declarations' },
			{ text: '命令与状态', link: '/zh/api/status' },
			{ text: '适配器契约', link: '/zh/api/adapters' },
			{ text: '错误与错误码', link: '/zh/api/errors' }
		]
	},
	{
		text: '框架',
		items: [
			{ text: 'Vue', link: '/zh/api/vue' },
			{ text: 'React', link: '/zh/api/react' }
		]
	},
	{
		text: '工具链',
		items: [
			{ text: 'CLI 命令', link: '/zh/api/cli' },
			{ text: 'Vite 插件', link: '/zh/api/vite' },
			{ text: 'Userscript API', link: '/zh/api/monkey' }
		]
	}
];

export default defineConfig({
	title: 'Makoo',
	description: 'A development framework for building component-based userscripts.',
	lang: 'en-US',
	base,
	cleanUrls: true,
	appearance: false,
	markdown: { theme: 'github-dark' },
	locales: {
		root: {
			label: 'English',
			lang: 'en-US',
			link: '/',
			title: 'Makoo',
			description: 'A development framework for building component-based userscripts.',
			themeConfig: {
				nav: [
					{ text: 'Docs', link: '/docs/' },
					{ text: 'API', link: '/api/core' }
				],
				sidebar: {
					'/docs/': enGuideSidebar,
					'/api/': enApiSidebar
				},
				langMenuLabel: 'Change language',
				returnToTopLabel: 'Return to top',
				sidebarMenuLabel: 'Menu'
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
				},
				langMenuLabel: '切换语言',
				returnToTopLabel: '返回顶部',
				sidebarMenuLabel: '菜单',
				outline: {
					label: '本页目录'
				},
				docFooter: {
					prev: '上一篇',
					next: '下一篇'
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
			provider: 'local',
			options: {
				locales: {
					zh: {
						translations: {
							button: {
								buttonText: '搜索文档',
								buttonAriaLabel: '搜索文档'
							},
							modal: {
								noResultsText: '无法找到相关结果',
								resetButtonTitle: '清除查询条件',
								footer: {
									selectText: '选择',
									navigateText: '切换',
									closeText: '关闭'
								}
							}
						}
					}
				}
			}
		},
		socialLinks: [{ icon: 'github', link: 'https://github.com/makoojs/Makoo' }]
	},
	vite: {
		plugins: [tailwindPlugin]
	}
});
