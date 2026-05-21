export interface MockStreamOptions {
  intervalMs?: number
  signal?: AbortSignal
}

export async function* mockStream(
  text: string,
  options: MockStreamOptions = {},
): AsyncGenerator<string, void, void> {
  const { intervalMs = 30, signal } = options
  for (const ch of Array.from(text)) {
    if (signal?.aborted) return
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, intervalMs)
      const onAbort = () => {
        clearTimeout(timer)
        reject(new DOMException('aborted', 'AbortError'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    }).catch(() => {})
    if (signal?.aborted) return
    yield ch
  }
}

export const SAMPLE_USER_QUESTION =
  '能帮我详细讲讲移动端 touchmove 事件失效的常见原因，以及在 AI chat 流式输出场景下为什么特别容易踩坑吗？最好附带一些示例代码和排查建议。'

export const SAMPLE_LONG_ANSWER = `# touchmove 失效问题完全解析

## 一、问题描述

在移动端浏览器中，**touchmove** 是处理用户滑动手势最核心的事件之一。无论你是要做自定义下拉刷新、横向滑动卡片，还是仅仅希望页面能够上下滚动，最终都依赖浏览器对 touchmove 的派发。

但是在某些场景下，明明用户正在按住屏幕拖动，touchmove 却**完全不触发**，页面像被冻结一样无法滚动。这种问题在 AI chat 应用里尤其高发，因为模型流式返回时，开发者很容易在不经意间触发了"DOM 节点高频替换"。

## 二、根本原因

要理解这个问题，必须先复习一下 W3C Touch Events 规范的一个关键约定：

> A user agent must dispatch the touchmove event(s) to the same EventTarget as the touchstart event that corresponded to the touch point, even if the touch point has since moved outside the interactive area of the original target.

翻译过来就是：**一次触摸序列（touchstart → touchmove* → touchend/touchcancel）的 target 在 touchstart 时就确定下来，整个序列都派发到这同一个 target 上**，即使手指已经移到了别的元素上方。

这条规则在大多数情况下都没有任何问题，但它隐含了一个前提：**touchstart 的 target 必须在序列结束前一直留在 DOM 树里**。一旦该节点在 touchmove 还没结束时被从 DOM 中移除（例如被 Vue/React 的 diff 算法销毁重建，或者被一句 \`innerHTML = ...\` 整体替换），浏览器就只能继续派发到一个"游离节点"上，结果是：

1. 你挂在 window/document 上的自定义 touchmove 监听拿不到事件（因为冒泡链断了）；
2. 浏览器原本应该接收到这些事件来驱动滚动手势的内部逻辑也拿不到，**原生滚动直接停摆**。

iOS Safari 上这个行为表现得最明显，Android Chrome 视版本不同有时会优雅降级，但仍然能观察到明显卡顿。

## 三、AI chat 场景为什么特别容易踩

流式返回有两个特点：

1. **高频率**：每秒可能 20~50 个 chunk，每次都触发一次重新渲染。
2. **持续时间长**：一段完整回答可能持续几十秒，远远超过一次触摸序列的时长。

也就是说，只要用户在回答过程中尝试滑动屏幕，几乎一定会撞上"touchstart 的目标节点在 touchmove 期间被销毁"的情况。

常见的、看起来很无辜实际却埋雷的写法包括：

- 用 \`v-html\` 把整段累积字符串通过 marked/markdown-it 解析后一次性塞进去；
- React 里 \`dangerouslySetInnerHTML={{ __html: parsed }}\` 每次重新赋值；
- 给消息组件设置 \`:key="msg.content"\` 这种**会随内容变化**的 key，导致每个 chunk 都触发组件 unmount + mount；
- 父组件每次 setState 时都新建一个消息数组引用，加上没设稳定 key，React/Vue 会按位置 diff 然后……依然销毁重建子树；
- 错误地以为 \`element.innerHTML += chunk\` 是追加，实际上等价于先序列化整个 innerHTML 再重新解析，所有原有子节点统统被替换。

## 四、修复策略

### 1. 用增量节点替代整段替换（首选）

把流式内容当成 token/字符的"列表"而不是"一整段字符串"。每来一个 chunk，**只在末尾 append 一个新节点**，不要碰前面已有的节点。Vue 里可以这样：

\`\`\`vue
<span v-for="(t, i) in tokens" :key="i">{{ t }}</span>
\`\`\`

React 里同理，用稳定的 index 或 token id 作 key。如果完全用原生 DOM，那就 \`element.appendChild(document.createTextNode(chunk))\`，或者维护一个 TextNode 调 \`node.appendData(chunk)\`。

### 2. 流式 markdown 的特殊处理

markdown 这种"前后内容可能影响整体结构"的场景天然和增量 append 不友好。可行方案：

- 流式阶段只渲染纯文本，回答结束后再做一次完整的 markdown parse 替换；
- 或者使用增量解析器（streaming-markdown 等），它能在已有 DOM 上做局部插入而不是整段替换；
- 实在不行，把 markdown 容器和"用户可能触摸滚动"的容器解耦——例如让滚动发生在外层 scroll 容器，markdown 重建只发生在内部，用户的 touchstart 落在外层时就不受影响。

### 3. 列表稳定 key

消息列表的 key 永远用稳定的 id（数据库主键或本地生成的 uuid），**绝不要**用 content、index of changing array、Date.now() 等会变化的值做 key。

### 4. CSS 加固

- \`touch-action: pan-y\` 告诉浏览器这个区域只允许垂直滚动，浏览器可以更激进地接管手势；
- \`overscroll-behavior: contain\` 防止滚动链穿透到外层；
- 监听 touch 事件时，如果你不需要 preventDefault，加上 \`{ passive: true }\`，让浏览器知道可以并行处理滚动。

### 5. 兜底：暂停渲染

如果上面这些都改造不了，最后的兜底方案是：在 touchstart 时暂存所有新到的 chunk 不渲染，touchend 之后再一次性 flush。这能避免序列中途的销毁重建，代价是用户滚动时回答会"停一下"。

## 五、排查 Checklist

下次再遇到"移动端某个区域按住就滑不动"，按这个顺序排查：

1. 在 Chrome DevTools 模拟器里给 window 加 touchstart / touchmove / touchend 监听，看 touchmove 是不是真的不派发；
2. 在 touchmove 监听里打印 \`document.contains(e.target)\`，如果是 false，基本就锁定"原 target 已被销毁"这个方向；
3. 用 DevTools 的 "Animations" 或 Performance 面板录一段，看流式期间是不是每帧都有大量 DOM 节点被移除/插入；
4. 检查你的渲染代码：有没有 v-html / dangerouslySetInnerHTML / innerHTML 赋值；
5. 检查 key：有没有绑到一个会变化的值上。

## 六、小结

touchmove 失效的本质是"浏览器还认得旧 target，但旧 target 已经不在 DOM 里"。在追求"立即看到最新内容"的 AI chat 场景里，开发者天然倾向写出整段替换式的渲染逻辑，所以这个坑出现得格外频繁。

记住一个心法：**流式渲染是"追加"，不是"重画"**。让 DOM 像河流一样只增不删，touchmove 自然就稳了。
`
