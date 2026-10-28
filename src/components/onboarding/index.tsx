import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ONBOARDING_REPLAY_EVENT,
  ONBOARDING_STORAGE_KEY,
  readOnboardingState,
  writeOnboardingState,
} from "@/middlelayers/onboarding-storage"

const OnboardingGuide = lazy(() => import("./onboarding-guide"))

export default function FirstRunOnboarding({ variant, ready }: { variant: "desktop" | "ios"; ready: boolean }) {
  const navigate = useNavigate()
  const checked = useRef(false)
  const openRef = useRef(false)
  const replayFocus = useRef<HTMLElement | null>(null)
  const mounted = useRef(false)
  const removeVisibility = useRef<(() => void) | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  function show() {
    if (openRef.current) return
    setStep(0)
    openRef.current = true
    setOpen(true)
  }
  function closeWithoutWriting() {
    openRef.current = false
    setOpen(false)
  }

  useEffect(() => {
    const replay = () => {
      if (openRef.current) return
      replayFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      show()
    }
    const storage = (event: StorageEvent) => {
      if (event.key === ONBOARDING_STORAGE_KEY && event.newValue) closeWithoutWriting()
    }
    window.addEventListener(ONBOARDING_REPLAY_EVENT, replay)
    window.addEventListener("storage", storage)
    return () => {
      window.removeEventListener(ONBOARDING_REPLAY_EVENT, replay)
      window.removeEventListener("storage", storage)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (ready && !checked.current) {
      checked.current = true
      if (!readOnboardingState()) {
        void import("@/middlelayers/onboarding").then(({ shouldAutoStartOnboarding }) => shouldAutoStartOnboarding()).then((start) => {
          if (!mounted.current || !start || openRef.current || readOnboardingState()) return
          if (document.visibilityState === "visible") {
            show()
          } else {
            const onVisible = () => {
              if (document.visibilityState !== "visible") return
              removeVisibility.current?.()
              removeVisibility.current = undefined
              if (readOnboardingState()) return
              show()
            }
            document.addEventListener("visibilitychange", onVisible)
            removeVisibility.current = () => document.removeEventListener("visibilitychange", onVisible)
          }
        })
      }
    }
    return () => {
      mounted.current = false
      removeVisibility.current?.()
      removeVisibility.current = undefined
    }
  }, [ready])

  function close(reason: "completed" | "skipped") {
    writeOnboardingState(reason)
    closeWithoutWriting()
    if (reason === "skipped" && replayFocus.current) {
      const control = replayFocus.current
      window.setTimeout(() => control.isConnected && control.focus(), 0)
    }
    replayFocus.current = null
    if (reason === "completed") {
      navigate(variant === "ios" ? "/settings/configuration?section=sources" : "/settings/configuration")
    }
  }

  return open ? <Suspense fallback={null}>
    <OnboardingGuide open={open} variant={variant} step={step} onStep={setStep} onClose={close} />
  </Suspense> : null
}
