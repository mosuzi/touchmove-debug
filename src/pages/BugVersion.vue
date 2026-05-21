<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { marked } from 'marked'
import ChatLayout from '../components/ChatLayout.vue'
import { mockStream, SAMPLE_LONG_ANSWER, SAMPLE_USER_QUESTION } from '../utils/mockStream'

const userQuestion = ref(SAMPLE_USER_QUESTION)
const assistantAnswer = ref('')

const streaming = ref(false)
const abortController = shallowRef<AbortController | null>(null)

// BUG 写法：每个 chunk 到达，computed 重新跑一次 marked.parse(整段)，
// v-html 把生成的整段 HTML 重新 set 到 .answer 的 innerHTML 上，
// 等价于销毁 .answer 下面所有 <p>/<ul>/<code>... 子节点然后重新创建。
// 用户的手指此刻正按在某个 <p> 上 → 那个 <p> 被销毁 → touch 序列的 target 脱离 DOM
// → .answer 这个 overflow-y: auto 容器收不到滚动手势 → 滑不动。
const renderedHtml = computed(() => marked.parse(assistantAnswer.value) as string)

const start = async () => {
  if (streaming.value) return
  assistantAnswer.value = ''
  streaming.value = true
  abortController.value = new AbortController()
  try {
    for await (const chunk of mockStream(SAMPLE_LONG_ANSWER, {
      intervalMs: 30,
      signal: abortController.value.signal,
    })) {
      assistantAnswer.value = assistantAnswer.value + chunk
    }
  } finally {
    streaming.value = false
    abortController.value = null
  }
}

const reset = () => {
  abortController.value?.abort()
  assistantAnswer.value = ''
}
</script>

<template>
  <ChatLayout
    tip="Bug 版：滚动被限制在下方 assistant 回答框内部。回答开始后，请按住回答区上下滑动，会发现滚不动，右上角探针 move 计数不再增长、attached 变红色 NO。"
    :streaming="streaming"
    @start="start"
    @reset="reset"
  >
    <div class="message user">
      <span class="role">user</span>
      {{ userQuestion }}
    </div>

    <div class="message assistant markdown-body fills">
      <span class="role">assistant（v-html 整段重渲染，回答区内部滚动）</span>
      <!--
        BUG 核心：v-html 每次都对 .answer 整段 set innerHTML，
        所有子节点（手指正按住的 <p> / <li> / <code>）每帧都被销毁重建。
      -->
      <div class="answer answer-scroll" v-html="renderedHtml" />
    </div>
  </ChatLayout>
</template>
