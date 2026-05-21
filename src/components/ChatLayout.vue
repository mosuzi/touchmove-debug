<script setup lang="ts">
defineProps<{
  tip?: string
  streaming: boolean
  buttonLabel?: string
}>()

defineEmits<{
  (e: 'start'): void
  (e: 'reset'): void
}>()
</script>

<template>
  <div class="chat-layout">
    <div v-if="tip" class="page-tip">{{ tip }}</div>
    <div class="chat-frame">
      <slot />
    </div>
    <div class="composer">
      <button :disabled="streaming" @click="$emit('start')">
        {{ streaming ? '回答中…（请尝试在回答区上下滑动）' : (buttonLabel || '开始回答') }}
      </button>
      <button v-if="!streaming" style="flex: 0 0 80px; background: #f2f3f5; color: #4e5969" @click="$emit('reset')">
        重置
      </button>
    </div>
  </div>
</template>
