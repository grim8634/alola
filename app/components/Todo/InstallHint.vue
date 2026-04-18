<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

/**
 * Install prompts for two platforms:
 *   - Android/Chrome: capture `beforeinstallprompt`; show CTA after the user has
 *     clearly engaged (we gate on a `completedCount` hint from the parent).
 *   - iOS Safari: no install event. UA-detect and show a one-time "share → Add
 *     to Home Screen" hint.
 * Dismissal is persisted in localStorage so we never nag.
 */

const props = defineProps<{ engagementHit?: boolean }>()

const DISMISS_KEY = 'alola_install_dismissed_v1'
const dismissed = ref<boolean>(false)
const deferred = ref<any>(null)
const isIOS = ref<boolean>(false)
const isStandalone = ref<boolean>(false)

onMounted(() => {
  if (typeof window === 'undefined') return
  dismissed.value = localStorage.getItem(DISMISS_KEY) === '1'
  // iOS Safari detection (rough; no proper beforeinstallprompt on iOS).
  const ua = navigator.userAgent
  isIOS.value = /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  // Already installed?
  isStandalone.value = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as any).standalone === true

  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault()
    deferred.value = e
  })
})

const show = computed(() => {
  if (dismissed.value || isStandalone.value) return false
  if (!props.engagementHit) return false
  return deferred.value !== null || isIOS.value
})

function dismiss() {
  dismissed.value = true
  try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
}

async function install() {
  if (!deferred.value) return
  deferred.value.prompt()
  const { outcome } = await deferred.value.userChoice
  deferred.value = null
  if (outcome !== 'accepted') dismiss()
  else dismiss()  // either way, stop nagging
}
</script>

<template>
  <Transition name="hint">
    <div
      v-if="show"
      class="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[92%] bg-surface-raised border border-ink-faint/15 rounded-xl px-3 py-2 shadow-xl flex items-center gap-3 text-sm"
      role="status"
    >
      <template v-if="deferred">
        <span class="text-ink">Install alola todos?</span>
        <button type="button" class="text-accent-light font-semibold" @click="install">Install</button>
      </template>
      <template v-else>
        <span class="text-ink-muted text-xs leading-snug">
          Tap <span class="inline-block align-middle">⎋</span> then <strong class="text-ink">Add to Home Screen</strong>.
        </span>
      </template>
      <button type="button" class="text-ink-faint px-1" aria-label="Dismiss" @click="dismiss">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.hint-enter-active, .hint-leave-active { transition: opacity 0.2s, transform 0.2s; }
.hint-enter-from, .hint-leave-to { opacity: 0; transform: translate(-50%, 8px); }
</style>
