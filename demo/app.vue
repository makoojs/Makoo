<script setup lang="ts">
defineOptions({ name: 'DemoPage' })

import React from 'react'
import { onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { createActivityStore, Injector } from '@makoo/core'
import { createReactAdapter } from '@makoo/react'
import { createVueAdapter } from '@makoo/vue'

import { InjectedBadge, InjectedCounter, InjectedTooltip } from './injectedWidgets'
import { InjectedReactBadge } from './injectedWidgets/InjectedReactBadge'
import HeroBlock from './components/layout/HeroBlock.vue'
import ActionBar from './components/ui/ActionBar.vue'
import DemoCard from './components/ui/DemoCard.vue'
import EventLog from './components/ui/EventLog.vue'
import { useDemoLogger } from './logger'
import BasicInjectionCase from './scenarios/BasicInjectionCase.vue'
import DelayedInjectionCase from './scenarios/DelayedInjectionCase.vue'
import EventBindingCase from './scenarios/EventBindingCase.vue'
import PureListenerCase from './scenarios/PureListenerCase.vue'
import ReactInjectionCase from './scenarios/ReactInjectionCase.vue'
import SignalListenerCase from './scenarios/SignalListenerCase.vue'
import type { RegisterResult } from '../packages/core/src/Task/types'

const activitySignal = ref(true)
const listenerActivitySignal = createActivityStore(activitySignal.value)
const reinjectActive = ref(false)
const { logs, addLog, patchConsoleForInjector } = useDemoLogger()

const injector = new Injector({ alive: false, scope: 'local' })
let restoreConsole: (() => void) | null = null

injector.applyAdapter(createVueAdapter())
injector.applyAdapter(createReactAdapter())

injector.register('#case-basic-target', InjectedBadge, {
    alive: false,
})


const result = injector.register('#case-delay-target', InjectedBadge, {
    alive: true,
})
injector.register('#case-event-target', InjectedCounter, {
    on: {
        listenAt: '#case-event-button',
        type: 'click',
        callback: () => addLog('Case 3: on.listenAt callback fired.'),
    },
})

injector.register('#case-signal-target', InjectedTooltip, {
    on: {
        listenAt: '#case-signal-button',
        type: 'click',
        callback: () => addLog('Case 4: callback fired with activitySignal.'),
        activitySignal: () => listenerActivitySignal,
    },
})

injector.registerListener('#case-listener-button', 'click', () => {
    addLog('Case 5: pure listener fired (no component injection).')
})


injector.register('#case-react-target', React.createElement(InjectedReactBadge))


provide<RegisterResult>('delayCase:result', result);

function isInjectorActive(): boolean {
    const taskContext = injector.getContext()
    if (!taskContext) return false

    for (const id of taskContext.keys()) {
        const status = taskContext.getTaskStatus(id)
        if (status === 'active' || status === 'pending') {
            return true
        }
    }

    return false
}

function run() {
    const wasActive = isInjectorActive()
    injector.run()
    reinjectActive.value = true
    if (wasActive) {
        addLog('Injector run() called again: active tasks were skipped.')
        return
    }
    addLog('Injector started: 6 demo cases are running.')
}


function reset() {
    injector.resetAll()
    reinjectActive.value = false
    activitySignal.value = true
    listenerActivitySignal.set(true)
    addLog('Reset complete: all task states reset.')
}

watch(activitySignal, (value) => {
    listenerActivitySignal.set(value)
})

onMounted(() => {
    restoreConsole = patchConsoleForInjector()
    addLog('Page loaded. Click "Run Injector" to start.')
})

onUnmounted(() => {
    restoreConsole?.()
    injector.destroyAll()
})
</script>

<template>
    <main class="page">
        <HeroBlock class="hero-card" title="Makoo"
            description="A breath of fresh air for legacy DOM — seamless Vue 3 integration for any website." />

        <section class="content-row">
            <section class="demo-container">
                <DemoCard title="📦 Basic">
                    <BasicInjectionCase />
                </DemoCard>

                <DemoCard title="⏳ Delay node">
                    <DelayedInjectionCase />
                </DemoCard>

                <DemoCard title="🔗 Component && outside Listener">
                    <EventBindingCase />
                </DemoCard>

                <DemoCard title="📡 Signal listener">
                    <SignalListenerCase />
                </DemoCard>

                <DemoCard title="🔊 Pure listener">
                    <PureListenerCase />
                </DemoCard>

                <DemoCard title="⚛️ React component">
                    <ReactInjectionCase />
                </DemoCard>

                <!-- <DemoCard title="Case 6: Reinject" subtitle="alive: true + node repeatedly unmounts/remounts">
                    <ReinjectCase :active="reinjectActive" />
                </DemoCard> -->
            </section>

            <div class="status-panel">
                <ActionBar v-model:activitySignal="activitySignal" @run="run" @reset="reset" />
                <EventLog :logs="logs" />
            </div>
        </section>

    </main>
</template>

<style scoped>
* {
    box-sizing: border-box;
}

.status-panel {
    display: flex;
    flex-direction: column;
    width: 350px;
    gap: 2px
}

.content-row {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 20px;
}

.page {
    min-height: 100vh;
    padding: 26px;
    display: grid;
    gap: 16px;
    background: linear-gradient(135deg,
            #d1f7ea 0%,
            #e8fbf5 35%,
            #e1f5fe 70%,
            #f3faff 100%);
    font-family: 'Segoe UI', system-ui, sans-serif;
}

.hero-card {
    justify-self: center;
}

.demo-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
}

@media (max-width: 768px) {
    .content-row {
        flex-direction: column;
        align-items: center;
    }

    .status-panel {
        width: 100%;
        max-width: 460px;
    }

    .page {
        padding: 16px;
    }
}
</style>
