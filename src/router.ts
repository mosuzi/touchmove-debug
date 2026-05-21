import { createRouter, createWebHashHistory } from 'vue-router'
import BugVersion from './pages/BugVersion.vue'
import FixedVersion from './pages/FixedVersion.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/bug' },
    { path: '/bug', name: 'bug', component: BugVersion, meta: { title: 'Bug 版' } },
    { path: '/fixed', name: 'fixed', component: FixedVersion, meta: { title: '修复版' } },
  ],
})
