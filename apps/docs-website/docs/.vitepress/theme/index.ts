import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { h } from 'vue';
import MakooBreadcrumb from './components/MakooBreadcrumb.vue';
import MakooHero from './components/MakooHero.vue';
import MakooNavSectionLabel from './components/MakooNavSectionLabel.vue';
import { normalizeSitePath } from './locale';
import '@fontsource-variable/inter';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import './style.css';

export default {
	extends: DefaultTheme,
	Layout: () => h(DefaultTheme.Layout, null, {
		'doc-before': () => h(MakooBreadcrumb),
		'nav-bar-title-after': () => h(MakooNavSectionLabel)
	}),
	enhanceApp({ app, siteData }) {
		app.component('MakooHero', MakooHero);
		if (typeof window === 'undefined') return;

		const base = siteData.value.base || '/';
		const sitePath = normalizeSitePath(window.location.pathname, base);
		const hasRedirected = window.sessionStorage.getItem('makoo-locale-redirected') === 'true';
		const usesChinese =
			window.navigator.languages?.some((lang) => lang.toLowerCase().startsWith('zh')) ??
			window.navigator.language.toLowerCase().startsWith('zh');

		if (!hasRedirected && sitePath === '/' && usesChinese) {
			window.sessionStorage.setItem('makoo-locale-redirected', 'true');
			const baseHref = `${base.replace(/\/+$/, '')}/`;
			window.location.replace(`${baseHref}zh/`);
		}
	}
} satisfies Theme;
