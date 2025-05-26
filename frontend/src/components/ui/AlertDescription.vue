<template>
  <div ref="descriptionRef" :class="['text-sm [&_p]:leading-relaxed', $attrs.class]">
    <slot></slot>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const descriptionRef = ref(null)
</script>

<script>
export default {
  name: 'AlertDescription'
}
</script>
