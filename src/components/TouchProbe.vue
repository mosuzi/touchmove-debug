<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const startCount = ref(0)
const moveCount = ref(0)
const endCount = ref(0)
const lastTargetTag = ref('-')
const targetAttached = ref<boolean | null>(null)

let lastStartTarget: EventTarget | null = null

const onStart = (e: TouchEvent) => {
  startCount.value++
  moveCount.value = 0
  endCount.value = 0
  lastStartTarget = e.target
  const el = e.target as Element | null
  lastTargetTag.value = describe(el)
  targetAttached.value = el ? document.contains(el) : null
}

const onMove = () => {
  moveCount.value++
  if (lastStartTarget instanceof Node) {
    targetAttached.value = document.contains(lastStartTarget)
  }
}

const onEnd = () => {
  endCount.value++
  if (lastStartTarget instanceof Node) {
    targetAttached.value = document.contains(lastStartTarget)
  }
}

const describe = (el: Element | null): string => {
  if (!el) return '-'
  const tag = el.tagName ? el.tagName.toLowerCase() : '?'
  const cls = (el as HTMLElement).className
  const c = typeof cls === 'string' && cls ? '.' + cls.split(/\s+/).slice(0, 1).join('.') : ''
  return `${tag}${c}`
}

onMounted(() => {
  window.addEventListener('touchstart', onStart, { passive: true, capture: true })
  window.addEventListener('touchmove', onMove, { passive: true, capture: true })
  window.addEventListener('touchend', onEnd, { passive: true, capture: true })
  window.addEventListener('touchcancel', onEnd, { passive: true, capture: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('touchstart', onStart, { capture: true } as any)
  window.removeEventListener('touchmove', onMove, { capture: true } as any)
  window.removeEventListener('touchend', onEnd, { capture: true } as any)
  window.removeEventListener('touchcancel', onEnd, { capture: true } as any)
})
</script>

<template>
  <div class="touch-probe" aria-hidden="true">
    <div class="row"><span>start</span><span>{{ startCount }}</span></div>
    <div class="row"><span>move</span><span>{{ moveCount }}</span></div>
    <div class="row"><span>end</span><span>{{ endCount }}</span></div>
    <div class="row"><span>target</span><span>{{ lastTargetTag }}</span></div>
    <div class="row">
      <span>attached</span>
      <span :class="targetAttached === false ? 'bad' : targetAttached === true ? 'ok' : ''">
        {{ targetAttached === null ? '-' : targetAttached ? 'yes' : 'NO' }}
      </span>
    </div>
  </div>
</template>
