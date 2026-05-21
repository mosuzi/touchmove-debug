<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import TouchProbe from './components/TouchProbe.vue'
</script>

<template>
  <div class="app-shell">
    <nav class="top-tabs">
      <RouterLink to="/bug">Bug 版</RouterLink>
      <RouterLink to="/fixed">修复版</RouterLink>
    </nav>
    <TouchProbe />
    <RouterView />
  </div>
</template>
