<template>
  <div
    ref="progressRef"
    :class="['relative h-4 w-full overflow-hidden rounded-full bg-secondary', $attrs.class]"
    role="progressbar"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="value"
  >
    <div
      class="h-full w-full flex-1 bg-primary transition-all"
      :style="{ transform: `translateX(-${100 - (value || 0)}%)` }"
    ></div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  value: {
    type: Number,
    default: 0
  }
})

const progressRef = ref(null)
</script>

<script>
export default {
  name: 'Progress'
}
</script>
