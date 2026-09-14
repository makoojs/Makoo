import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { h } from 'vue';
import MakooBreadcrumb from './components/MakooBreadcrumb.vue';
import MakooHero from './components/MakooHero.vue';
import MakooNavSectionLabel from './components/MakooNavSectionLabel.vue';
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
	enhanceApp({ app, router }) {
		app.component('MakooHero', MakooHero);
		if (typeof window === 'undefined') return;

		if (router) {
			const prevHook = router.onAfterRouteChanged;
			router.onAfterRouteChanged = (to: string) => {
				prevHook?.(to);
				if (to.startsWith('/zh/') || to === '/zh') {
					window.localStorage.setItem('makoo-preferred-lang', 'zh');
				} else if (to.startsWith('/docs/') || to.startsWith('/api/') || to === '/') {
					window.localStorage.setItem('makoo-preferred-lang', 'en');
				}
			};
		}

		const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') + '/';
		const currentPath = window.location.pathname;
		const isRootPath = currentPath === base || currentPath === base.slice(0, -1) || currentPath === '/' || currentPath === '';
		const hasRedirected = window.sessionStorage.getItem('makoo-locale-redirected') === 'true';
		const preferredLang = window.localStorage.getItem('makoo-preferred-lang');

		if (preferredLang === 'en') return;

		const usesChinese = preferredLang === 'zh' || (window.navigator.languages?.some((lang) =>
			lang.toLowerCase().startsWith('zh')
		) ?? window.navigator.language.toLowerCase().startsWith('zh'));

		if (!hasRedirected && isRootPath && usesChinese) {
			window.sessionStorage.setItem('makoo-locale-redirected', 'true');
			window.location.replace(`${base}zh/`);
		}
	}
} satisfies Theme;
