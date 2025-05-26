<template>
  <div
    ref="alertRef"
    role="alert"
    :class="[
      'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
      variantClasses
    ]"
    v-bind="$attrs"
  >
    <slot></slot>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'destructive'].includes(value)
  }
})

const alertRef = ref(null)

const variantClasses = computed(() => {
  return props.variant === 'destructive'
    ? 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive'
    : 'bg-background text-foreground'
})
</script>

<script>
export default {
  name: 'Alert'
}
</script>
