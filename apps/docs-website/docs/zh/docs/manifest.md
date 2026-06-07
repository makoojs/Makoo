# Manifest 参考

Manifest 用来声明 Makoo 项目里的注入模块。顶层 manifest 位于 `injections/manifest.ts`，模块级 manifest 可以放在 `injections/<module>/manifest.ts`。

```txt
injections
├─ manifest.ts
├─ header
│  ├─ app.vue
│  └─ manifest.ts
└─ badge
   └─ app.tsx
```

Makoo 会先加载顶层 manifest，再扫描模块目录，并按 `moduleId` 合并模块级 manifest。

## 顶层 Manifest

使用 `@makoojs/cli` 提供的 `defineInjections()`：

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	globalInjector: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	injections: {
		header: {
			injectAt: '#header',
			component: './header/app.vue'
		},
		badge: {
			injectAt: 'body',
			component: './badge/app.tsx',
			match: {
				include: ['https://example.com/profile/*']
			}
		}
	}
});
```

| 字段 | 说明 |
| --- | --- |
| `globalInjector` | 当前 manifest 注入集合的运行时默认值 |
| `injections` | 对象或数组形式的注入模块配置 |

`globalInjector` 支持 `alive`、`scope`、`timeout` 和 `hooks`。模块没有显式设置同名字段时，会继承这些默认值。

## 对象写法

对象写法适合大多数项目，因为对象 key 会成为模块名。

```ts
export default defineInjections({
	injections: {
		'profile-card': {
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	}
});
```

这个模块会解析为 `moduleId: 'profile-card'`。

## 数组写法

数组写法适合配置由代码生成，或者用列表维护更清楚的场景。

```ts
export default defineInjections({
	injections: [
		{
			name: 'profile-card',
			injectAt: '.profile',
			component: './profile-card/app.vue'
		}
	]
});
```

使用数组写法时，如果你需要稳定的模块 id，建议提供 `name`。

## 模块级 Manifest

模块可以提供自己的 `manifest.ts`：

```ts
// injections/profile-card/manifest.ts
export default {
	injectAt: '.profile',
	component: './app.vue',
	alive: true
};
```

当模块希望自己维护目标节点、组件路径、URL 规则或运行时选项时，模块级 manifest 会更合适。模块级 manifest 中的路径会从当前模块目录解析。

如果模块级 manifest 的模块 id 和顶层 manifest 某个条目相同，模块级配置会替换顶层解析结果。如果它引入了新的模块 id，Makoo 会把它加入最终注入列表。

## 模块字段

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `name` | 仅数组写法常用 | 稳定模块 id |
| `injectAt` | 是 | 目标节点 CSS 选择器 |
| `component` | 是 | 相对于 manifest 位置的组件路径 |
| `framework` | 否 | `'auto'`、`'Vue'` 或 `'React'` |
| `enabled` | 否 | 是否包含该模块，默认 `true` |
| `match` | 否 | 模块级 URL 规则 |
| `alive` | 否 | 当前模块是否需要重新注入 |
| `scope` | 否 | 重新注入观察范围，`'local'` 或 `'global'` |
| `timeout` | 否 | 等待目标节点的毫秒数 |
| `hooks` | 否 | 模块级生命周期 hooks |
| `on` | 否 | 事件监听绑定选项 |

## 组件路径

在顶层 manifest 中，组件路径从 `injections/manifest.ts` 解析：

```ts
component: './profile-card/app.vue'
```

在模块级 manifest 中，组件路径从模块目录解析：

```ts
// injections/profile-card/manifest.ts
export default {
	component: './app.vue',
	injectAt: '.profile'
};
```

## 框架解析

Makoo 可以从组件扩展名推断框架：

| 扩展名 | 框架 |
| --- | --- |
| `.vue` | `Vue` |
| `.tsx` | `React` |
| `.jsx` | `React` |

你也可以显式设置框架：

```ts
framework: 'Vue'
```

当自动推断足够时，可以省略该字段，或设置 `framework: 'auto'`。如果 Makoo 无法从组件路径推断框架，会抛出错误。

## URL 匹配

`match` 控制模块是否在当前页面注册。它会在运行时根据 `location.href` 判断。

简写形式：

```ts
match: ['https://example.com/profile/*']
```

对象形式：

```ts
match: {
	include: ['https://example.com/profile/*'],
	exclude: ['https://example.com/profile/settings']
}
```

模块级 `match` 比 `monkey.userscript.match` 更细。脚本管理器必须先在页面上运行整个 userscript，然后 Makoo 才能判断这个 userscript 里的哪些模块应该注册。

## 运行时选项

模块会从 `globalInjector` 或项目级 injector 配置继承 `alive`、`scope` 和 `timeout`。当某个模块需要不同表现时，可以在模块级配置上覆盖：

```ts
export default defineInjections({
	globalInjector: {
		alive: false,
		timeout: 5000
	},
	injections: {
		stable: {
			injectAt: '#stable',
			component: './stable/app.vue'
		},
		dynamic: {
			injectAt: '#dynamic',
			component: './dynamic/app.vue',
			alive: true,
			scope: 'global',
			timeout: 10000
		}
	}
});
```

`stable` 会继承 `alive: false` 和 `timeout: 5000`。`dynamic` 会覆盖这些值。

> [!NOTE]
> **整体继承优先级**：`module config` > `manifest.globalInjector` >
> `vite.config.ts injector` > `Makoo default`。

> [!WARNING]
> 这个优先级可能会在后续版本调整。当前命名容易让用户迷惑，项目级 injector 默认值和
> manifest 级 injector 默认值之间的职责也可能会被调整或简化。

## Hooks

Hooks 可以是全局的，也可以是模块级的：

```ts
export default defineInjections({
	globalInjector: {
		hooks: {
			'run:start': (payload) => {
				console.log(payload);
			}
		}
	},
	injections: {
		panel: {
			injectAt: 'body',
			component: './panel/app.vue',
			hooks: {
				'artifact:mountSuccess': (payload) => {
					console.log(payload);
				}
			}
		}
	}
});
```

全局 hooks 适合项目级观察。模块 hooks 更适合只属于某个注入模块的行为。

## 启用和禁用模块

模块默认启用。设置 `enabled: false` 可以把模块保留在 manifest 中，但从生成的运行时里排除：

```ts
export default defineInjections({
	injections: {
		experimental: {
			enabled: false,
			injectAt: 'body',
			component: './experimental/app.vue'
		}
	}
});
```

扫描和合并结束后，Makoo 会移除禁用模块。如果最终没有任何启用模块，扫描会给出明确错误。
