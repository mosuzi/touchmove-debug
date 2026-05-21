<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import ChatLayout from '../components/ChatLayout.vue'
import { mockStream, SAMPLE_LONG_ANSWER, SAMPLE_USER_QUESTION } from '../utils/mockStream'

const userQuestion = ref(SAMPLE_USER_QUESTION)
// 修复点 1：流式内容用 token 数组维护，不再是单一字符串 + v-html
const tokens = ref<string[]>([])

const streaming = ref(false)
const abortController = shallowRef<AbortController | null>(null)

const start = async () => {
  if (streaming.value) return
  tokens.value = []
  streaming.value = true
  abortController.value = new AbortController()
  try {
    for await (const chunk of mockStream(SAMPLE_LONG_ANSWER, {
      intervalMs: 30,
      signal: abortController.value.signal,
    })) {
      // 修复点 2：只在末尾 push 新 token，前面所有 DOM 节点完全不动。
      // touchstart 落在任何一个旧 <span> 上时，整个触摸序列内它都不会被销毁。
      tokens.value.push(chunk)
    }
  } finally {
    streaming.value = false
    abortController.value = null
  }
}

const reset = () => {
  abortController.value?.abort()
  tokens.value = []
}
</script>

<template>
  <ChatLayout
    tip="修复版：同样把滚动限制在回答框内部，但内容是增量 append 的 <span> 列表。请按住回答区上下滑动，可以正常滚动，探针 move 持续累加、attached 始终 yes。"
    :streaming="streaming"
    @start="start"
    @reset="reset"
  >
    <div class="message user">
      <span class="role">user</span>
      {{ userQuestion }}
    </div>

    <div class="message assistant fills">
      <span class="role">assistant（增量 append，纯文本，回答区内部滚动）</span>
      <!--
        修复点 3：把流式内容拆成 <span> 列表，:key 用稳定 index。
        每个 chunk 只 push 一个新 span，旧 span 不会被销毁，touch 序列的 target 始终在 DOM。
        修复点 4：滚动容器加 touch-action: pan-y 与 overscroll-behavior: contain，
        告诉浏览器只允许垂直滚动并阻止滚动链穿透，作为额外加固。

        NOTE：若业务上必须渲染 markdown，请：
          a) 流式期间只显示纯文本，结束后再做一次完整 marked.parse 替换；
          b) 或使用支持增量插入的流式 markdown 解析器；
          c) 切勿对累积字符串反复 v-html。
      -->
      <div class="answer answer-scroll with-fix">
        <span v-for="(t, i) in tokens" :key="i">{{ t }}</span>
      </div>
    </div>
  </ChatLayout>
</template>
