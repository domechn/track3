import { motion } from "framer-motion"
import { useId } from "react"

type Props = { variant: "desktop" | "ios"; reduced: boolean }
type StepId = "welcome" | "sources" | "history" | "deeper" | "backup"
const ease: [number, number, number, number] = [0.2, 0.8, 0.2, 1]
const V = {
  one: "var(--ill-1)", two: "var(--ill-2)", three: "var(--ill-3)", four: "var(--ill-4)",
  surface: "var(--ill-surface)", line: "var(--ill-line)", bar: "var(--ill-bar)", ink: "var(--ill-ink)",
}

function anim(reduced: boolean, initial: Record<string, number>, delay: number, duration: number, easing: number[] | "easeInOut" = ease) {
  return reduced ? { initial: false as const } : {
    initial, animate: Object.fromEntries(Object.keys(initial).map((key) => [key, key === "opacity" ? 1 : key === "scale" || key === "scaleX" || key === "scaleY" ? 1 : 0])),
    transition: { delay, duration, ease: easing },
  }
}

function Bar({ x, y, width, height = 6, fill = V.bar }: { x: number; y: number; width: number; height?: number; fill?: string }) {
  return <rect x={x} y={y} width={width} height={height} rx={height / 2} fill={fill} />
}
function Check({ x, y, r = 8, reduced, delay }: { x: number; y: number; r?: number; reduced: boolean; delay: number }) {
  return <motion.g style={{ transformBox: "fill-box", transformOrigin: "center" }} {...anim(reduced, { opacity: 0, scale: .85 }, delay, .22)}>
    <circle cx={x} cy={y} r={r} fill={V.one} />
    <path d={`M${x - r * .38} ${y}l${r * .25} ${r * .28} ${r * .47} -${r * .55}`} stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </motion.g>
}
function Svg({ id, reduced, children }: { id: StepId; reduced: boolean; children: React.ReactNode }) {
  return <svg viewBox="0 0 320 240" fill="none" aria-hidden="true" data-reduced={String(reduced)} data-testid={`onboarding-illustration-${id}`}>{children}</svg>
}

function Welcome({ reduced }: Props) {
  return <Svg id="welcome" reduced={reduced}>
    <motion.g style={{ transformBox: "fill-box", transformOrigin: "center" }} {...anim(reduced, { opacity: 0, scale: .96 }, 0, .45)}>
      <rect x="52" y="34" width="200" height="146" rx="14" fill={V.surface} stroke={V.line} />
      <Bar x={70} y={52} width={54} />
    </motion.g>
    <motion.rect x="70" y="68" width="98" height="14" rx="5" fill={V.ink} style={{ transformBox: "fill-box", transformOrigin: "left center" }} {...anim(reduced, { scaleX: 0 }, .2, .42)} />
    {[0, 1, 2].map((i) => <motion.g key={i} {...anim(reduced, { opacity: 0, y: 10 }, .32 + i * .12, .38)}>
      <circle cx="78" cy={106 + i * 24} r="6" fill={[V.one, V.two, V.three][i]} />
      <Bar x={92} y={102.5 + i * 24} width={66 - i * 10} />
      <Bar x={198} y={102.5 + i * 24} width={38 - i * 6} />
    </motion.g>)}
    {!reduced && <motion.circle cx="246" cy="170" r="40" stroke={V.one} strokeWidth="2" style={{ transformBox: "fill-box", transformOrigin: "center" }} initial={{ opacity: .5, scale: .8 }} animate={{ opacity: 0, scale: 1.3 }} transition={{ delay: 1.75, duration: .8, ease }} />}
    <motion.g {...anim(reduced, { opacity: 0, y: 10 }, .9, .45)}>
      <path d="M246 128l32 11.5v25c0 21-13.5 35-32 42.5-18.5-7.5-32-21.5-32-42.5v-25z" fill={V.one} />
      <rect x="233" y="160" width="26" height="20" rx="5" fill="#fff" />
      <circle cx="246" cy="170" r="2.6" fill={V.one} />
      <motion.path d="M238.5 160v-6a7.5 7.5 0 0 1 15 0v6" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" {...anim(reduced, { y: -5 }, 1.45, .3)} />
    </motion.g>
  </Svg>
}

function Sources({ reduced }: Props) {
  return <Svg id="sources" reduced={reduced}>
    <motion.g style={{ transformBox: "fill-box", transformOrigin: "center" }} {...anim(reduced, { opacity: 0, scale: .96 }, 0, .4)}>
      <rect x="36" y="20" width="248" height="200" rx="14" fill={V.surface} stroke={V.line} />
      <Bar x={54} y={40} width={64} height={8} />
      <rect x="54" y="66" width="212" height="4" rx="2" fill={V.bar} />
    </motion.g>
    <motion.rect x="54" y="66" width="212" height="4" rx="2" fill={V.one} style={{ transformBox: "fill-box", transformOrigin: "left center" }} {...anim(reduced, { scaleX: 0 }, 1.35, .9, "easeInOut")} />
    <motion.g initial={reduced ? false : { scale: 1 }} animate={reduced ? undefined : { scale: [1, .95, 1] }} transition={{ delay: 1.2, duration: .18, ease }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
      <rect x="196" y="31" width="70" height="26" rx="8" fill="hsl(var(--primary))" />
      <motion.g initial={reduced ? false : { rotate: -360 }} animate={reduced ? undefined : { rotate: 0 }} transition={{ delay: 1.35, duration: .9, ease: "easeInOut" }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <path d="M216.5 41.2a6 6 0 1 0 1.4 4.8" stroke="hsl(var(--primary-foreground))" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M217.6 37.6v3.8h-3.8" stroke="hsl(var(--primary-foreground))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <Bar x={227} y={41} width={30} fill="hsl(var(--primary-foreground) / .85)" />
    </motion.g>
    {["B", "₿", "IB"].map((glyph, i) => <motion.g key={i} {...anim(reduced, { opacity: 0, x: 24 }, .3 + i * .25, .38)}>
      <rect x="52" y={84 + i * 44} width="216" height="36" rx="10" fill="hsl(var(--muted) / .7)" />
      <circle cx="74" cy={102 + i * 44} r="11" fill={[V.one, V.two, V.three][i]} />
      <text x="74" y={106 + i * 44} textAnchor="middle" fontSize={glyph.length > 1 ? 9 : 12} fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">{glyph}</text>
      <Bar x={94} y={93 + i * 44} width={64 - i * 6} />
      <Bar x={94} y={105 + i * 44} width={38} height={5} />
    </motion.g>)}
    {[0, 1, 2].map((i) => <Check key={i} x={248} y={102 + i * 44} reduced={reduced} delay={2.25 + i * .11} />)}
  </Svg>
}

function History({ reduced }: Props) {
  const id = useId().replaceAll(":", "")
  const line = "M36 112C58 108 70 100 88 102S120 92 136 94S166 78 184 84S218 70 234 68S264 58 282 54"
  return <Svg id="history" reduced={reduced}>
    <defs><linearGradient id={`area-${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={V.one} stopOpacity=".22" /><stop offset="1" stopColor={V.one} stopOpacity="0" /></linearGradient></defs>
    <rect x="20" y="14" width="280" height="118" rx="14" fill={V.surface} stroke={V.line} />
    <rect x="36" y="30" width="78" height="13" rx="5" fill={V.ink} />
    <motion.g {...anim(reduced, { opacity: 0 }, 2.3, .3)}><rect x="122" y="29" width="50" height="16" rx="8" fill={V.one} fillOpacity=".14" /><text x="147" y="40.5" textAnchor="middle" fontSize="10" fontWeight="700" fill={V.one} fontFamily="system-ui, sans-serif">+4.2%</text></motion.g>
    <motion.path d={`${line}L282 122L36 122Z`} fill={`url(#area-${id})`} {...anim(reduced, { opacity: 0 }, .8, .5)} />
    <motion.path d={line} pathLength={1} strokeDasharray={1} stroke={V.one} strokeWidth="2.5" strokeLinecap="round" initial={reduced ? false : { pathLength: 0 }} animate={reduced ? undefined : { pathLength: 1 }} transition={{ duration: 1.2, ease: "easeInOut" }} />
    <motion.circle cx="282" cy="54" r="4.5" fill={V.one} stroke={V.surface} strokeWidth="2" style={{ transformBox: "fill-box", transformOrigin: "center" }} {...anim(reduced, { opacity: 0, scale: .85 }, 1.15, .22)} />
    <rect x="20" y="142" width="280" height="88" rx="14" fill={V.surface} stroke={V.line} />
    {[1, 2, 3].map((n) => {
      const y = 152 + (n - 1) * 24
      const times = n === 1 ? [0, 2.1, 2.3, 2.6] : n === 2 ? [0, 1.7, 1.9, 2.1, 2.3, 2.6] : [0, 1.3, 1.5, 1.7, 1.95, 2.1, 2.3, 2.6]
      const offsets = n === 1 ? [-4, -4, 0, 0] : n === 2 ? [-28, -28, -24, -24, 0, 0] : [-52, -52, -48, -48, -24, -24, 0, 0]
      const arrivals = n === 1 ? 2.3 : n === 2 ? 1.9 : 1.5
      return <motion.g key={n} initial={reduced ? false : { opacity: 0, y: offsets[0] }} animate={reduced ? undefined : { opacity: times.map((t) => t < arrivals ? 0 : 1), y: offsets }} transition={{ duration: 2.6, times: times.map((t) => t / 2.6), ease }} >
        {n === 1 && <rect x="28" y={y} width="264" height="20" rx="6" fill={V.one} fillOpacity=".08" />}
        <Bar x={38} y={y + 7} width={46} />
        <circle cx="112" cy={y + 10} r="5.5" fill={V.one} /><circle cx="121" cy={y + 10} r="5.5" fill={V.two} stroke={V.surface} strokeWidth="1.5" /><circle cx="130" cy={y + 10} r="5.5" fill={V.three} stroke={V.surface} strokeWidth="1.5" />
        <Bar x={222} y={y + 7} width={58 - n * 4} fill={V.ink} />
      </motion.g>
    })}
  </Svg>
}

function Deeper({ variant, reduced }: Props) {
  return <Svg id="deeper" reduced={reduced}>
    {[[20, 14], [166, 14], [20, 124], [166, 124]].map(([x, y], i) => <motion.rect key={i} x={x} y={y} width="134" height="102" rx="14" fill={V.surface} stroke={V.line} {...anim(reduced, { opacity: 0, y: 10 }, i * .1, .4)} />)}
    <Bar x={36} y={30} width={52} />
    {[0, 1, 2].map((i) => <motion.rect key={i} x="36" y={52 + i * 17} width={100 - i * 18} height="11" rx="4" fill={[V.one, V.two, V.four][i]} fillOpacity=".9" style={{ transformBox: "fill-box", transformOrigin: "left center" }} {...anim(reduced, { scaleX: 0 }, .6 + i * .15, .45)} />)}
    <Bar x={182} y={30} width={40} />
    <circle cx="233" cy="76" r="22" stroke={V.bar} strokeWidth="7" />
    <g transform="rotate(-90 233 76)"><motion.circle cx="233" cy="76" r="22" stroke={V.one} strokeWidth="7" strokeLinecap="round" initial={reduced ? false : { strokeDasharray: "0 138.23" }} animate={reduced ? undefined : { strokeDasharray: "99.5 138.23" }} transition={{ delay: .7, duration: 1.2, ease: "easeInOut" }} strokeDasharray={reduced ? "99.5 138.23" : undefined} /></g>
    <text x="233" y="80" textAnchor="middle" fontSize="11" fontWeight="700" fill={V.ink} fontFamily="system-ui, sans-serif">72%</text>
    <Bar x={36} y={140} width={56} />
    <path d="M36 172H138" stroke="hsl(var(--muted-foreground))" strokeOpacity=".6" strokeDasharray="3 3" />
    {[1.5, .55, .9].map((scaleY, i) => <motion.rect key={i} x={46 + i * 30} y="172" width="18" height="34" rx="4" fill={[V.one, V.two, V.three][i]} style={{ transformBox: "fill-box", transformOrigin: "center bottom" }} {...anim(reduced, { scaleY }, .9, 1.1, "easeInOut")} />)}
    <Bar x={182} y={140} width={variant === "ios" ? 44 : 36} />
    {variant === "ios" ? <>
      <path d="M233 160c-9 0-14 7-14 15v9l-4 6h36l-4-6v-9c0-8-5-15-14-15z" fill="hsl(var(--muted-foreground) / .3)" />
      <path d="M228 194a5 5 0 0 0 10 0" stroke="hsl(var(--muted-foreground) / .5)" strokeWidth="2.5" strokeLinecap="round" />
      {!reduced && <motion.circle cx="246" cy="163" r="10" stroke={V.one} strokeWidth="2" style={{ transformBox: "fill-box", transformOrigin: "center" }} initial={{ opacity: .5, scale: .8 }} animate={{ opacity: 0, scale: 1.3 }} transition={{ delay: 1.9, duration: .7, ease }} />}
      <motion.circle cx="246" cy="163" r="6" fill={V.one} style={{ transformBox: "fill-box", transformOrigin: "center" }} {...anim(reduced, { opacity: 0, scale: .85 }, 1.7, .24)} />
    </> : <>
      <rect x="254" y="134" width="30" height="16" rx="8" stroke="hsl(var(--muted-foreground) / .6)" />
      <text x="269" y="145.5" textAnchor="middle" fontSize="9" fontWeight="600" fill={V.ink} fontFamily="system-ui, sans-serif">Pro</text>
      <motion.g {...anim(reduced, { opacity: 0, y: 10 }, 1.3, .36)}><rect x="182" y="160" width="76" height="20" rx="9" fill="hsl(var(--muted) / .9)" /><Bar x={191} y={167} width={50} /></motion.g>
      <motion.g {...anim(reduced, { opacity: 0, y: 10 }, 1.65, .36)}><rect x="210" y="186" width="62" height="20" rx="9" fill={V.one} />{[0, 1, 2].map((i) => <motion.circle key={i} cx={229 + i * 12} cy="196" r="2.6" fill="#fff" initial={reduced ? false : { opacity: .35 }} animate={reduced ? undefined : { opacity: [.35, 1, .35, 1, .35] }} transition={{ delay: 2 + i * .15, duration: 1.2, ease: "easeInOut" }} />)}</motion.g>
    </>}
  </Svg>
}

function Backup({ reduced }: Props) {
  const id = useId().replaceAll(":", "")
  return <Svg id="backup" reduced={reduced}>
    <defs><mask id={`sync-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="240"><motion.path d="M84 190H236" pathLength={1} stroke="#fff" strokeWidth="8" strokeDasharray={1} initial={reduced ? false : { pathLength: 0 }} animate={reduced ? undefined : { pathLength: 1 }} transition={{ delay: 1.6, duration: .7, ease: "easeInOut" }} /></mask></defs>
    <motion.g {...anim(reduced, { opacity: 0, y: 10 }, 0, .4)}>
      <rect x="24" y="30" width="108" height="80" rx="12" fill={V.surface} stroke={V.line} /><rect x="38" y="44" width="52" height="10" rx="4" fill={V.ink} />
      <Bar x={38} y={64} width={72} /><Bar x={38} y={78} width={56} /><Bar x={38} y={92} width={64} />
    </motion.g>
    <motion.g {...anim(reduced, { opacity: 0, y: 10 }, .12, .4)}><path d="M190 52a8 8 0 0 1 8-8h26l9 9h47a8 8 0 0 1 8 8v45a8 8 0 0 1-8 8h-82a8 8 0 0 1-8-8z" fill={V.one} fillOpacity=".14" stroke={V.one} strokeWidth="1.6" /></motion.g>
    <motion.g initial={reduced ? false : { opacity: 0, x: -156, y: 2 }} animate={reduced ? undefined : { opacity: [0, 1, 1], x: [-156, -156, 0], y: [2, 2, 0] }} transition={{ delay: .4, duration: .9, times: [0, .12, 1], ease }}>
      <path d="M226 64h16l7 7v23a3 3 0 0 1-3 3h-20a3 3 0 0 1-3-3V67a3 3 0 0 1 3-3z" fill={V.surface} stroke={V.one} strokeWidth="1.6" /><path d="M242 64v7h7" stroke={V.one} strokeWidth="1.6" strokeLinejoin="round" /><Bar x={228} y={78} width={14} height={3} /><Bar x={228} y={85} width={10} height={3} />
    </motion.g>
    <Check x={282} y={108} r={10} reduced={reduced} delay={1.3} />
    <g opacity=".9">
      <path d="M84 190H236" stroke="hsl(var(--muted-foreground) / .7)" strokeWidth="2" strokeDasharray="4 5" mask={`url(#sync-${id})`} />
      <motion.g {...anim(reduced, { opacity: 0, y: 10 }, 1.5, .35)}><rect x="52" y="168" width="30" height="46" rx="7" fill={V.surface} stroke={V.line} /><Bar x={62} y={207} width={10} height={2.5} /><rect x="238" y="168" width="30" height="46" rx="7" fill={V.surface} stroke={V.line} /><Bar x={248} y={207} width={10} height={2.5} /></motion.g>
      <motion.g style={{ transformBox: "fill-box", transformOrigin: "center" }} {...anim(reduced, { opacity: 0, scale: .96 }, 1.8, .35)}><path d="M140 204h40a13 13 0 0 0 1.5-25.9A19 19 0 0 0 145 176a14 14 0 0 0-5 28z" fill={V.surface} stroke={V.line} strokeWidth="1.5" /></motion.g>
      <motion.g style={{ transformBox: "fill-box", transformOrigin: "center" }} {...anim(reduced, { opacity: 0, scale: .85 }, 2.2, .26)}><rect x="153" y="185" width="16" height="13" rx="3" fill={V.one} /><path d="M156.5 185v-3.5a4.5 4.5 0 0 1 9 0v3.5" stroke={V.one} strokeWidth="2" strokeLinecap="round" /></motion.g>
    </g>
  </Svg>
}

export function Illustration({ id, variant, reduced }: Props & { id: StepId }) {
  const props = { variant, reduced }
  switch (id) {
    case "welcome": return <Welcome {...props} />
    case "sources": return <Sources {...props} />
    case "history": return <History {...props} />
    case "deeper": return <Deeper {...props} />
    case "backup": return <Backup {...props} />
  }
}
