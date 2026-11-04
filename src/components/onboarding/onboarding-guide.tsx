import * as Dialog from "@radix-ui/react-dialog"
import { motion, useReducedMotion } from "framer-motion"
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "@/i18n"
import { getAccessibleMotionProps } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { useHaptics } from "@/utils/use-haptics"
import { Illustration } from "./illustrations"
import guideArt1 from "./guide-art-1.svg?raw"
import guideArt2 from "./guide-art-2.svg?raw"
import guideArt3 from "./guide-art-3.svg?raw"
import guideArt4 from "./guide-art-4.svg?raw"
import guideArt5 from "./guide-art-5.svg?raw"
import PhoneFidelityArt from "./phone-fidelity-art"
import { TrackLogo } from "@/components/brand/track-logo"
import "./onboarding.css"

const steps = ["welcome", "sources", "history", "deeper", "backup"] as const
const guideArt = [guideArt1, guideArt2, guideArt3, guideArt4, guideArt5]
const ease = [0.2, 0.8, 0.2, 1] as const
type Variant = "desktop" | "ios"
type CloseReason = "completed" | "skipped"

export default function OnboardingGuide({ open, variant, step, onStep, onClose, confirmReplay = false, onConfirmReplay, onCancelReplay }: {
  open: boolean
  variant: Variant
  step: number
  onStep: (step: number) => void
  onClose: (reason: CloseReason) => void
  confirmReplay?: boolean
  onConfirmReplay?: () => void
  onCancelReplay?: () => void
}) {
  const { t } = useTranslation()
  const initialReduced = useReducedMotion()
  const [reduced, setReduced] = useState(() => Boolean(initialReduced) || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches))
  const haptic = useHaptics()
  const contentRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const nextRef = useRef<HTMLButtonElement>(null)
  const pointerStart = useRef<{ x: number; y: number }>()
  const closeTimer = useRef<number>()
  const closingRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const previousStep = useRef(step)
  const [direction, setDirection] = useState(1)
  const [announcement, setAnnouncement] = useState("")
  const id = steps[step]
  const last = step === steps.length - 1
  const [fullScreenSheet, setFullScreenSheet] = useState(() => variant === "ios" && (window.innerWidth < 700 || window.innerHeight < 500))
  const [fidelityDesktop, setFidelityDesktop] = useState(() => variant === "desktop" && window.innerWidth >= 1400)
  const phoneFidelity = variant === "ios" && fullScreenSheet && window.innerWidth >= 380 && window.innerHeight >= 700
  const count = t(phoneFidelity ? "fidelity.guide.stepCount" : "onboarding.stepCount").replace("{current}", String(step + 1)).replace("{total}", String(steps.length))

  useEffect(() => {
    if (variant !== "desktop") return
    const update = () => setFidelityDesktop(window.innerWidth >= 1400)
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [variant])

  useEffect(() => {
    if (variant !== "ios") return
    const media = window.matchMedia("(max-width: 699px), (max-height: 499px)")
    const update = () => setFullScreenSheet(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [variant])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(media.matches)
    media.addEventListener?.("change", update)
    update()
    return () => media.removeEventListener?.("change", update)
  }, [])

  useEffect(() => {
    if (step === previousStep.current) return
    previousStep.current = step
    setAnnouncement(t("onboarding.stepAnnounce").replace("{current}", String(step + 1)).replace("{total}", String(steps.length)).replace("{title}", t(`onboarding.${id}.title`)))
  }, [id, step, t])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  function go(delta: number) {
    if (closingRef.current) return
    const next = Math.max(0, Math.min(steps.length - 1, step + delta))
    if (next === step) return
    setDirection(delta)
    onStep(next)
    if (variant === "ios") haptic("selection")
    if (next === 0 && document.activeElement?.getAttribute("data-testid") === "onboarding-back") {
      queueMicrotask(() => nextRef.current?.focus())
    }
  }

  function complete() {
    if (closingRef.current) return
    if (variant === "ios") haptic("success")
    startClose("completed")
  }

  function startClose(reason: CloseReason) {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    closeTimer.current = window.setTimeout(() => onClose(reason), 150)
  }
  const skip = () => startClose("skipped")
  const label = t(last ? "onboarding.notNow" : "onboarding.skip")
  const primary = last ? t("onboarding.addFirstSource") : t("onboarding.next")
  const counter = <span className="ob-count">{count}</span>
  const back = <button type="button" data-testid="onboarding-back" className="ob-ios-text-btn" style={step === 0 ? { visibility: "hidden" } : undefined} onClick={() => go(-1)} tabIndex={step === 0 ? -1 : 0}>{t("onboarding.back")}</button>
  const skipButton = <button type="button" data-testid="onboarding-skip" className="ob-ios-text-btn" onClick={skip}>{label}</button>
  const next = <button type="button" ref={nextRef} data-testid={last ? "onboarding-cta-add-source" : "onboarding-next"} className="ob-ios-primary" onClick={last ? complete : () => go(1)}>{primary}</button>

  if (confirmReplay) return <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancelReplay?.() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fidelity-guide-confirm-overlay" />
      <Dialog.Content className="fidelity-guide-confirm" data-testid="onboarding-dialog" data-step="welcome"
        aria-describedby="fidelity-guide-confirm-description"
        onEscapeKeyDown={(event) => { event.preventDefault(); onCancelReplay?.() }}>
        <Dialog.Title>{t("fidelity.b.about.replayConfirmTitle")}</Dialog.Title>
        <Dialog.Description id="fidelity-guide-confirm-description">{t("fidelity.b.about.replayConfirmBody")}</Dialog.Description>
        <button type="button" className="is-primary" onClick={onConfirmReplay}>{t("fidelity.b.about.startGuide")}</button>
        <button type="button" onClick={onCancelReplay}>{t("common.cancel")}</button>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
  if (fidelityDesktop) {
    return <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) skip() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ob-fidelity-overlay" />
        <Dialog.Content asChild onOpenAutoFocus={(event) => { event.preventDefault(); contentRef.current?.focus() }} onEscapeKeyDown={(event) => { event.preventDefault(); skip() }} onPointerDownOutside={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()}>
          <div ref={contentRef} tabIndex={-1} data-testid="onboarding-dialog" data-step={id} data-variant={variant} data-closing={closing} className="ob-fidelity-desktop" onKeyDown={(event) => {
            if (event.key === "ArrowRight") { event.preventDefault(); go(1) }
            if (event.key === "ArrowLeft") { event.preventDefault(); go(-1) }
            if (event.key === "Enter" && event.target === event.currentTarget) {
              event.preventDefault()
              if (last) nextRef.current?.focus()
              else go(1)
            }
          }}>
            <header className="ob-fidelity-top">
              <div className="ob-fidelity-brand"><TrackLogo size={28} decorative />Track3</div>
              <span className="ob-fidelity-count">{step + 1} of {steps.length}</span>
              <button type="button" data-testid="onboarding-skip" className="ob-fidelity-skip" onClick={skip}>{last ? t("onboarding.fidelity.close") : t("onboarding.skip")}</button>
            </header>
            <div className="ob-fidelity-mid">
              <div className="ob-fidelity-grid">
                <div className="ob-fidelity-body" role="region" aria-labelledby={titleId} tabIndex={0} data-testid={`onboarding-step-${id}`}>
                  <div className="ob-fidelity-eyebrow">{t(`onboarding.fidelity.${id}.eyebrow`)}</div>
                  <Dialog.Title id={titleId} className="ob-fidelity-title">{t(`onboarding.fidelity.${id}.title`)}</Dialog.Title>
                  <Dialog.Description className="ob-fidelity-description">{t(`onboarding.fidelity.${id}.body`)}</Dialog.Description>
                  <div className="ob-fidelity-dots" role="tablist" aria-label={count} data-testid="onboarding-progress">{steps.map((item, index) => <span key={item} className={index === step ? "active" : index < step ? "done" : ""} />)}</div>
                  <div className="ob-fidelity-actions">
                    <button type="button" data-testid="onboarding-back" disabled={step === 0} onClick={() => go(-1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m9.5 3-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{t("onboarding.back")}</button>
                    <button type="button" ref={nextRef} data-testid={last ? "onboarding-cta-add-source" : "onboarding-next"} className="primary" onClick={last ? complete : () => go(1)}>{primary}{!last && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6.5 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</button>
                  </div>
                </div>
                <div className="ob-fidelity-art"><div className="ob-fidelity-design-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: guideArt[step] }} /><span className="ob-fidelity-old-art"><Illustration id={id} variant={variant} reduced={reduced} /></span></div>
              </div>
            </div>
            <div aria-live="polite" className="sr-only" data-testid="onboarding-live">{announcement}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  }

  return <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) skip() }}>
    <Dialog.Portal>
      <Dialog.Overlay asChild>
        <motion.div data-closing={closing} className={`ob-overlay ${variant === "ios" ? "ob-ios-overlay" : ""}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? .15 : .2, ease: reduced ? "linear" : "easeOut" }} />
      </Dialog.Overlay>
      <Dialog.Content asChild aria-labelledby={titleId} onOpenAutoFocus={(event) => { event.preventDefault(); contentRef.current?.focus() }} onEscapeKeyDown={(event) => { event.preventDefault(); skip() }} onPointerDownOutside={(event) => { if (fullScreenSheet) event.preventDefault() }} onInteractOutside={(event) => { if (fullScreenSheet) event.preventDefault() }}>
        <motion.div
          ref={contentRef}
          tabIndex={-1}
          data-testid="onboarding-dialog"
          data-closing={closing}
          data-step={id}
          data-variant={variant}
          className={`ob-dialog ${variant === "ios" ? "ios-onboarding" : "ob-desktop"}${phoneFidelity ? " fd-guide" : ""}`}
          {...(reduced
            ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: .15, ease: "linear" as const } }
            : fullScreenSheet
              ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: .25, ease } }
              : getAccessibleMotionProps(false, { initial: { opacity: 0, scale: .97 }, animate: { opacity: 1, scale: 1 }, transition: { duration: .28, ease } }))}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") { event.preventDefault(); go(1) }
            if (event.key === "ArrowLeft") { event.preventDefault(); go(-1) }
            if (event.key === "Enter" && event.target === event.currentTarget) {
              event.preventDefault()
              if (last) nextRef.current?.focus()
              else go(1)
            }
          }}
          onPointerDown={(event) => { if (variant === "ios") pointerStart.current = { x: event.clientX, y: event.clientY } }}
          onPointerUp={(event) => {
            const start = pointerStart.current
            pointerStart.current = undefined
            if (variant !== "ios" || !start) return
            const dx = event.clientX - start.x
            const dy = event.clientY - start.y
            if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? 1 : -1)
          }}
        >
          {phoneFidelity ? <>
            <div className="fd-guide-top">
              <div className="fd-guide-brand"><TrackLogo size={28} decorative />Track3</div>
              <span className="fd-guide-count">{count}</span>
              <button type="button" data-testid="onboarding-skip" className="fd-guide-skip" onClick={skip}>{t(last ? "fidelity.guide.close" : "onboarding.skip")}</button>
            </div>
            <div className="fd-guide-stage">
              <div className="fd-guide-art" data-testid={`onboarding-illustration-${id}`} aria-hidden="true"><PhoneFidelityArt step={step} t={t} />
                {id === "deeper" && <svg className="fd-guide-ring" viewBox="0 0 480 290" aria-hidden="true"><circle className="fd-guide-pulse" cx="376" cy="128" r="35" fill="none" stroke="#d9a441" strokeWidth="2" /></svg>}
              </div>
              <div className="ob-text fd-guide-copy" role="region" aria-label={t(`fidelity.guide.eyebrow.${id}`)} tabIndex={0}>
                <div className="fd-guide-eyebrow">{t(`fidelity.guide.eyebrow.${id}`)}</div>
                <Dialog.Title id={titleId} className="ob-title">{t(`fidelity.guide.title.${id}`)}</Dialog.Title>
                <Dialog.Description className="ob-desc">{t(`fidelity.guide.body.${id}`)}</Dialog.Description>
              </div>
            </div>
            <div className="fd-guide-foot">
              <div className="fd-guide-dots" data-testid="onboarding-progress" aria-hidden="true">{steps.map((item, index) => <span key={item} className={index === step ? "active" : ""} />)}</div>
              <div className="fd-guide-actions">
                <button type="button" data-testid="onboarding-back" className="fd-guide-back" disabled={step === 0} onClick={() => go(-1)}><ChevronLeftIcon aria-hidden="true" />{t("onboarding.back")}</button>
                <button type="button" ref={nextRef} data-testid={last ? "onboarding-cta-add-source" : "onboarding-next"} className="fd-guide-next" onClick={last ? complete : () => go(1)}>
                  {last && <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M9 3.5v11M3.5 9h11" /></svg>}{t(last ? "onboarding.addFirstSource" : "onboarding.next")}{!last && <ChevronRightIcon aria-hidden="true" />}
                </button>
              </div>
            </div>
          </> : <>
          {variant === "ios" && <div className="ob-ios-bar">{back}{skipButton}</div>}
          <motion.div key={`art-${id}-${reduced}`} className="ob-art" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? .15 : .24, ease: reduced ? "linear" : ease }}>
            <Illustration id={id} variant={variant} reduced={reduced} />
          </motion.div>
          <div className="ob-body">
            {variant === "desktop" && <div className="ob-head">{counter}<Button type="button" variant="ghost" data-testid="onboarding-skip" onClick={skip} className="text-muted-foreground">{label}</Button></div>}
            <motion.div key={`text-${id}-${reduced}`} className="ob-text" role="region" aria-labelledby={titleId} tabIndex={0} data-testid={`onboarding-step-${id}`} initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * 12 }} animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }} transition={{ duration: reduced ? .15 : .24, ease: reduced ? "linear" : ease }}>
              {variant === "ios" && counter}
              <Dialog.Title id={titleId} className="ob-title">{t(`onboarding.${id}.title`)}</Dialog.Title>
              <Dialog.Description className="ob-desc">{t(`onboarding.${id}.body`)}</Dialog.Description>
              {id === "welcome" && <ul className="ob-points">
                <li><PointIcon kind="device" />{t("onboarding.welcome.point.local")}</li>
                <li><PointIcon kind="lock" />{t("onboarding.welcome.point.encrypted")}</li>
                <li><PointIcon kind="eye" />{t("onboarding.welcome.point.readOnly")}</li>
              </ul>}
              {id === "sources" && <p className="ob-note">{t("onboarding.sources.note")}</p>}
              {id === "deeper" && variant === "desktop" && <p className="ob-note"><span className="ob-pro">{t("app.proBadge").toLowerCase().replace(/^./, (first) => first.toUpperCase())}</span>{t("onboarding.deeper.pro")}</p>}
              {id === "backup" && <p className="ob-note">{t("onboarding.backup.sync")}</p>}
            </motion.div>
            <div className="ob-foot">
              <div className="ob-dots" data-testid="onboarding-progress" aria-hidden="true">{steps.map((item, index) => <span key={item} className={index === step ? "active" : ""} />)}</div>
              {variant === "desktop" ? <div className="ob-actions">
                {step > 0 && <Button type="button" variant="ghost" data-testid="onboarding-back" onClick={() => go(-1)}>{t("onboarding.back")}</Button>}
                <Button type="button" ref={nextRef} data-testid={last ? "onboarding-cta-add-source" : "onboarding-next"} onClick={last ? complete : () => go(1)}>{primary}</Button>
              </div> : next}
            </div>
          </div>
          </>}
          <div aria-live="polite" className="sr-only" data-testid="onboarding-live">{announcement}</div>
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function PointIcon({ kind }: { kind: "device" | "lock" | "eye" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "device" && <><rect x="3" y="4" width="18" height="12" rx="2.5" /><path d="M8 20h8M12 16v4" /></>}
    {kind === "lock" && <><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>}
    {kind === "eye" && <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>}
  </svg>
}
