import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { h } from 'vue';
import MakooBreadcrumb from './components/MakooBreadcrumb.vue';
import MakooHero from './components/MakooHero.vue';
import './style.css';

export default {
	extends: DefaultTheme,
	Layout: () => h(DefaultTheme.Layout, null, {
		'doc-before': () => h(MakooBreadcrumb)
	}),
	enhanceApp({ app }) {
		app.component('MakooHero', MakooHero);
		if (typeof window === 'undefined') return;
		const hasRedirected = window.sessionStorage.getItem('makoo-locale-redirected') === 'true';
		const isRootPath = window.location.pathname === '/';
		const usesChinese = window.navigator.languages?.some((lang) =>
			lang.toLowerCase().startsWith('zh')
		) ?? window.navigator.language.toLowerCase().startsWith('zh');

		if (!hasRedirected && isRootPath && usesChinese) {
			window.sessionStorage.setItem('makoo-locale-redirected', 'true');
			window.location.replace('/zh/');
		}
	}
} satisfies Theme;
