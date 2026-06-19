import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LogOut, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/CurrentBusinessContext';
import { supabase } from '@/db/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = 'idle' | 'typing' | 'generating' | 'complete'

interface ApiResult {
  extracted_data: Record<string, any>
  confidence_map: Record<string, string> | null
  completeness_score: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_CARDS = [
  {
    initials: 'PU',
    name: 'PacUX',
    tagline: 'Turning complex products into intuitive experiences',
    services: ['UX Audit', 'Product Design', 'Usability Testing'],
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    seed: "I run PacUX, a UX design studio specializing in product design and usability research for SaaS companies. I offer UX audits, product design sprints, and usability testing. Design sprints are $4,500/week, audits from $1,200.",
  },
  {
    initials: 'BC',
    name: 'Baked by Clara',
    tagline: "Custom cakes and pastries for life's sweetest moments",
    services: ['Custom Cakes', 'Event Catering', 'Baking Classes'],
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    seed: "I'm Clara, running Baked by Clara — custom cakes, event catering, and baking workshops. Custom cakes start at $150, workshops are $85 per person. I work with couples, corporates, and everyone in between.",
  },
  {
    initials: 'FC',
    name: 'Frost & Co. CPA',
    tagline: 'Tax strategy and accounting for growing businesses',
    services: ['Tax Planning', 'Bookkeeping', 'Business Advisory'],
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.12)',
    seed: "I'm a CPA at Frost & Co., offering tax planning, monthly bookkeeping, and business advisory for small businesses and freelancers. Bookkeeping retainers from $350/mo, tax prep from $500.",
  },
] as const;

const GEN_STEPS = [
  { label: 'Parsing business identity',        artifact: 'identity' },
  { label: 'Extracting services and pricing',  artifact: 'services' },
  { label: 'Generating brand kit',             artifact: 'brand'    },
  { label: 'Drafting proposal template',       artifact: 'proposal' },
  { label: 'Building your pipeline',           artifact: 'pipeline' },
  { label: 'Your business OS is ready',        artifact: 'portal'   },
] as const;

// Approximate brand color by presence tier — applied immediately at step 1 before main API returns
const TIER_COLORS: Record<string, string> = {
  b2b_creative:       '#6366f1',  // design / creative
  b2c_local:          '#f59e0b',  // local / consumer
  b2b_professional:   '#0ea5e9',  // CPA / legal / finance
  hybrid_professional: '#10b981', // default
}

// Ambient blob clip-path keyframes — never repeats exactly
const BLOB_PATHS = [
  'polygon(30% 0%, 70% 2%, 98% 28%, 100% 68%, 72% 98%, 32% 100%, 2% 74%, 0% 34%)',
  'polygon(45% 0%, 82% 12%, 100% 48%, 88% 84%, 56% 100%, 18% 92%, 0% 58%, 12% 18%)',
  'polygon(36% 4%, 76% 0%, 100% 40%, 96% 76%, 62% 100%, 24% 98%, 2% 66%, 6% 26%)',
  'polygon(30% 0%, 70% 2%, 98% 28%, 100% 68%, 72% 98%, 32% 100%, 2% 74%, 0% 34%)',
]

// ─── Artifact preview card ────────────────────────────────────────────────────

function seedFallbackName(seed: string): string {
  // Try "I run X" / "running X" / "called X" patterns first
  const runMatch = seed.match(/(?:I run|running|called|named)\s+([A-Z][^\s,]+(?:\s+[A-Z&][^\s,]+)*)/i)
  if (runMatch) return runMatch[1].trim().slice(0, 30)
  // Fall back to first capitalised word cluster
  const capMatch = seed.match(/\b([A-Z][a-z]+(?:\s+[A-Z&][a-z]+)+)/)
  if (capMatch) return capMatch[1].trim().slice(0, 30)
  return 'Your Business'
}

function seedFallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function ArtifactCard({ step, data, brandColor, seed }: {
  step: number
  data: ApiResult | null
  brandColor: string
  seed: string
}) {
  const ed = data?.extracted_data
  const identity = ed?.identity ?? {}
  const services: any[] = ed?.services?.slice(0, 3) ?? []
  const brand = ed?.brand ?? {}
  const proposal = ed?.proposal ?? {}
  const pipeline = ed?.pipeline ?? {}

  const rawBizName = identity.businessName ?? identity.name
  const bizName = rawBizName ?? (data ? seedFallbackName(seed) : '…')
  const initials = identity.initials ?? (rawBizName ? rawBizName.slice(0, 2).toUpperCase() : (data ? seedFallbackInitials(bizName) : '??'))
  const tagline = identity.tagline ?? identity.niche ?? ''

  const swatchColors = [
    brand.primaryColor   ?? brandColor,
    brand.secondaryColor ?? '#6b7280',
    brand.accentColor    ?? '#d1fae5',
    brand.ctaColor       ?? '#059669',
  ]

  const stages: string[] = pipeline.stages ?? ['Lead', 'Proposal', 'Active', 'Won']
  const proposalIntro: string = proposal.intro ?? proposal.approach ?? ''

  const bg = `${brandColor}1a`  // ~10% opacity hex

  const placeholder = (
    <div className="flex flex-col gap-2">
      {[70, 50, 60].map(w => (
        <div key={w} className="h-3 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  const cards: Record<string, React.ReactNode> = {
    identity: (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold"
            style={{ background: bg, color: brandColor }}>
            {data ? initials : '??'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{data ? bizName : <span className="inline-block h-3 w-24 rounded bg-muted animate-pulse" />}</p>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{data ? tagline : <span className="inline-block h-2.5 w-32 rounded bg-muted animate-pulse" />}</p>
          </div>
        </div>
      </div>
    ),
    services: (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Services</p>
        {data ? (
          services.length ? services.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs truncate mr-2">{s.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{s.price}</span>
            </div>
          )) : placeholder
        ) : placeholder}
      </div>
    ),
    brand: (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Brand</p>
        <div className="flex gap-2">
          {data ? swatchColors.map((c, i) => (
            <div key={i} className="h-8 flex-1 rounded-md" style={{ background: c }} />
          )) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 flex-1 rounded-md bg-muted animate-pulse" />
            ))
          )}
        </div>
        {data && brand.tone && (
          <p className="text-xs text-muted-foreground capitalize">{brand.tone} tone</p>
        )}
      </div>
    ),
    proposal: (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Proposal template</p>
        {data ? (
          proposalIntro ? (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">"{proposalIntro}"</p>
          ) : placeholder
        ) : placeholder}
      </div>
    ),
    pipeline: (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Pipeline stages</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {data ? stages.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-xs px-2 py-0.5 rounded-full border">{s}</span>
              {i < stages.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
            </div>
          )) : (
            [60, 75, 55, 65].map((w, i) => (
              <div key={i} className="h-5 rounded-full bg-muted animate-pulse" style={{ width: `${w}px` }} />
            ))
          )}
        </div>
      </div>
    ),
    portal: (
      <div className="flex flex-col gap-2">
        <div className="h-1.5 w-full rounded-full" style={{ background: brandColor }} />
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
            style={{ background: bg, color: brandColor }}>
            {data ? initials : '??'}
          </div>
          <div>
            <p className="text-xs font-semibold">{data ? bizName : '…'}</p>
            <p className="text-[10px] text-muted-foreground">{data ? 'forgefly.io/p/…' : '…'}</p>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {(data && services.length ? services.slice(0, 2) : [{name:''},{name:''}]).map((s, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: bg, color: brandColor }}>
              {s.name || <span className="inline-block w-10 h-2 bg-muted animate-pulse rounded" />}
            </span>
          ))}
        </div>
      </div>
    ),
  }

  const artifactKey = GEN_STEPS[step]?.artifact ?? 'identity'

  return (
    <div className="rounded-xl border bg-card p-4 min-h-[110px] flex flex-col justify-center">
      {cards[artifactKey] ?? placeholder}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NoBusinessPage() {
  const { signOut } = useAuth()
  const { refetch } = useBusiness()
  const navigate = useNavigate()

  const [pageState, setPageState] = useState<PageState>('idle')
  const [seed, setSeed] = useState('')
  const [activeStep, setActiveStep] = useState(-1)
  const [apiResult, setApiResult] = useState<ApiResult | null>(null)
  const [apiError, setApiError] = useState(false)
  const [brandColor, setBrandColor] = useState('#10b981')
  const [pendingPayload, setPendingPayload] = useState<Record<string, any> | null>(null)
  const [showReveal, setShowReveal] = useState(false)

  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Step advancement: 0→4 on timer, 5 only after API returns ──────────────
  useEffect(() => {
    if (pageState !== 'generating') return
    setActiveStep(0)

    stepTimerRef.current = setInterval(() => {
      setActiveStep(prev => (prev < 4 ? prev + 1 : prev))
    }, 1600)

    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
    }
  }, [pageState])

  // ── Advance to step 5 + complete when API returns and steps have caught up ─
  useEffect(() => {
    if (!apiResult || activeStep < 4 || pageState !== 'generating') return
    if (stepTimerRef.current) clearInterval(stepTimerRef.current)

    const t1 = setTimeout(() => setActiveStep(5), 300)
    const t2 = setTimeout(() => setPageState('complete'), 1400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [apiResult, activeStep, pageState])

  // ── Extract brand color from API response ─────────────────────────────────
  useEffect(() => {
    if (!apiResult) return
    const color = apiResult.extracted_data?.brand?.primaryColor
    if (color && /^#[0-9a-f]{3,6}$/i.test(color)) setBrandColor(color)
  }, [apiResult])

  // ── Reveal beat: 350ms stillness after complete, then spring portal up ────
  useEffect(() => {
    if (pageState !== 'complete') { setShowReveal(false); return }
    const t = setTimeout(() => setShowReveal(true), 350)
    return () => clearTimeout(t)
  }, [pageState])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current)
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
    }
  }, [])

  // ── Demo card click: type in the seed, then auto-generate ─────────────────
  const handleDemoCardClick = (cardSeed: string) => {
    if (pageState !== 'idle') return
    if (typingRef.current) clearTimeout(typingRef.current)

    setSeed('')
    setPageState('typing')

    const msPerChar = Math.max(2, Math.floor(400 / cardSeed.length))
    let i = 0

    const typeNext = () => {
      if (i <= cardSeed.length) {
        setSeed(cardSeed.slice(0, i))
        i++
        typingRef.current = setTimeout(typeNext, msPerChar)
      } else {
        // Typing done — auto-start generation after a short pause
        typingRef.current = setTimeout(() => startGeneration(cardSeed), 200)
      }
    }
    typingRef.current = setTimeout(typeNext, 0)
  }

  // ── Own-seed generate button ──────────────────────────────────────────────
  const handleGenerateClick = () => {
    const prompt = seed.trim()
    if (!prompt || pageState !== 'idle') return
    startGeneration(prompt)
  }

  // ── Core generation: fires API call, runs in parallel with step timer ─────
  const startGeneration = async (prompt: string) => {
    setPageState('generating')
    setApiResult(null)
    setApiError(false)
    setActiveStep(-1)
    setShowReveal(false)

    // #67 — fire early classify in parallel for approximate brand color at step 1
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ mode: 'classify', prompt }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const tier = d?.business_profile?.presence_tier as string | undefined
        const early = TIER_COLORS[tier ?? '']
        if (early) setBrandColor(early)
      })
      .catch(() => {})

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ mode: 'extract', prompt }),
        },
      )
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      // Guard: never save empty extracted_data — retry with explicit seed framing
      if (data.not_applicable || !data.extracted_data?.identity) {
        const retryRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              mode: 'extract',
              prompt: `I am describing my freelance business. Extract all sections including identity, services, brand, pipeline, and proposal. Business description: ${prompt}`,
            }),
          },
        )
        if (retryRes.ok) {
          const retryData = await retryRes.json()
          if (retryData.extracted_data?.identity) {
            Object.assign(data, retryData)
          }
        }
        // If retry also fails, abort — don't save empty business
        if (!data.extracted_data?.identity) {
          throw new Error('Extraction returned no data. Please describe your business in more detail.')
        }
      }

      const payload = {
        extracted_data: data.extracted_data,
        prompt,
        elapsed_seconds: 0,
        timestamp: Date.now(),
        confidence_map: data.confidence_map ?? null,
        completeness_score: data.completeness_score ?? 0,
      }

      localStorage.setItem('pending_portal', JSON.stringify(payload))
      setPendingPayload(payload)

      try {
        const { data: row } = await supabase
          .from('pending_businesses')
          .insert({
            extracted_data: data.extracted_data,
            prompt,
            elapsed_seconds: 0,
            confidence_map: data.confidence_map ?? null,
            completeness_score: data.completeness_score ?? 0,
          })
          .select('token')
          .single()
        if (row?.token) localStorage.setItem('pending_portal_token', row.token)
      } catch {
        // non-fatal
      }

      setApiResult({ extracted_data: data.extracted_data, confidence_map: data.confidence_map, completeness_score: data.completeness_score })
    } catch (err) {
      console.error('Generate error:', err)
      setApiError(true)
      setPageState('idle')
    }
  }

  const handleCTA = () => {
    // refetch() re-runs fetchBusiness which picks up pending_portal from localStorage,
    // saves to DB, and sets business — AppShellContent stops showing NoBusinessPage
    refetch()
    navigate('/dashboard')
  }

  // ── Render: idle / typing ─────────────────────────────────────────────────
  if (pageState === 'idle' || pageState === 'typing') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-2xl flex flex-col gap-8">
            <div className="text-center flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Describe your business to get started
              </h1>
              <p className="text-sm text-muted-foreground">
                Forgefly builds your workspace in seconds — clients, proposals, invoices, and more.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Textarea
                value={seed}
                onChange={e => {
                  if (pageState === 'typing') return  // don't let user edit while typing
                  setSeed(e.target.value)
                }}
                readOnly={pageState === 'typing'}
                placeholder="e.g. I'm a freelance brand designer charging $120/hr, mostly working with startups on logos, decks, and brand guidelines…"
                className="min-h-[100px] resize-none text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerateClick()
                }}
              />
              <Button
                onClick={handleGenerateClick}
                disabled={!seed.trim() || pageState === 'typing'}
                className="self-end gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Sparkles className="h-4 w-4" />
                Generate my OS
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or explore an example</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DEMO_CARDS.map(card => (
                <button
                  key={card.name}
                  type="button"
                  onClick={() => handleDemoCardClick(card.seed)}
                  disabled={pageState === 'typing'}
                  className="text-left rounded-xl border bg-card hover:bg-muted/40 transition-all hover:shadow-sm hover:scale-[1.01] p-4 flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold"
                      style={{ background: card.bg, color: card.color }}
                    >
                      {card.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                        {card.tagline}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {card.services.map(s => (
                      <span key={s} className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: card.bg, color: card.color }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {apiError && (
              <p className="text-center text-sm text-destructive">
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ── Render: generating ────────────────────────────────────────────────────
  if (pageState === 'generating') {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-hidden">
        <Header />

        {/* Ambient morphing blob */}
        <motion.div
          className="pointer-events-none fixed"
          style={{
            width: '70vmax',
            height: '70vmax',
            top: '-15vmax',
            right: '-25vmax',
            background: `${brandColor}0d`,
            zIndex: 0,
          }}
          animate={{ clipPath: BLOB_PATHS }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', times: [0, 0.33, 0.66, 1] }}
        />

        <main className="flex-1 flex items-center justify-center px-6 py-10 relative z-10">
          <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Step list */}
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Building your OS</p>
              {GEN_STEPS.map((s, i) => {
                const isDone = i < activeStep
                const isActive = i === activeStep
                return (
                  <div key={i} className="flex items-center gap-3">
                    {/* Indicator */}
                    <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                      {isDone ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: brandColor }}
                        >
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        </motion.div>
                      ) : isActive ? (
                        <motion.div
                          className="w-3 h-3 rounded-full"
                          style={{ background: brandColor }}
                          animate={{ scale: [1, 1.35, 1] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                      )}
                    </div>
                    {/* Label */}
                    <span className={`text-sm transition-colors ${
                      isDone ? 'text-foreground' :
                      isActive ? 'text-foreground font-medium' :
                      'text-muted-foreground/50'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Artifact preview */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Preview</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  <ArtifactCard
                    step={Math.max(0, activeStep)}
                    data={apiResult}
                    brandColor={brandColor}
                    seed={seed}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Render: complete + reveal beat (#69) ─────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <Header />

      {/* Ambient blob */}
      <motion.div
        className="pointer-events-none fixed"
        style={{
          width: '70vmax',
          height: '70vmax',
          top: '-15vmax',
          right: '-25vmax',
          background: `${brandColor}0d`,
          zIndex: 0,
        }}
        animate={{ clipPath: BLOB_PATHS }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', times: [0, 0.33, 0.66, 1] }}
      />

      {/* Background fades during reveal — 350ms stillness lets all checkmarks read first */}
      <motion.main
        animate={{ opacity: showReveal ? 0.18 : 1 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex items-center justify-center px-6 py-10 relative z-10"
      >
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Build complete</p>
            {GEN_STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: brandColor }}>
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
                <span className="text-sm text-foreground">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Preview</p>
            <ArtifactCard step={5} data={apiResult} brandColor={brandColor} seed={seed} />
          </div>
        </div>
      </motion.main>

      {/* Portal spring-slides up from bottom after 350ms stillness */}
      <AnimatePresence>
        {showReveal && apiResult && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50"
            style={{ height: '78vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 130, mass: 0.7 }}
          >
            <PortalPreview
              data={apiResult}
              brandColor={brandColor}
              seed={seed}
              onSave={handleCTA}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Portal reveal preview (#69) ─────────────────────────────────────────────

function PortalPreview({ data, brandColor, seed, onSave }: {
  data: ApiResult
  brandColor: string
  seed: string
  onSave: () => void
}) {
  const ed = data.extracted_data
  const identity = ed.identity ?? {}
  const services: any[] = ed.services?.slice(0, 4) ?? []

  const rawBizName = identity.businessName ?? identity.name
  const bizName = rawBizName ?? seedFallbackName(seed)
  const initials = identity.initials ?? (rawBizName ? rawBizName.slice(0, 2).toUpperCase() : seedFallbackInitials(bizName))
  const tagline = identity.tagline ?? ''
  const bg = `${brandColor}15`

  return (
    <div className="h-full flex flex-col bg-background border-t rounded-t-2xl shadow-2xl overflow-hidden">
      {/* Brand bar */}
      <div className="h-1 shrink-0" style={{ background: brandColor }} />

      {/* Drag handle */}
      <div className="flex justify-center pt-2.5 pb-1 shrink-0">
        <div className="h-1 w-8 rounded-full bg-muted-foreground/20" />
      </div>

      {/* Business header */}
      <div className="px-5 py-3 flex items-center gap-3 shrink-0">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
          style={{ background: bg, color: brandColor }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{bizName}</p>
          {tagline && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{tagline}</p>}
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex gap-5 px-5 border-b shrink-0">
        {['Services', 'Proposals', 'Invoices', 'Pipeline'].map((tab, i) => (
          <span
            key={tab}
            className={`text-xs pb-2.5 ${i === 0 ? 'font-semibold' : 'text-muted-foreground'}`}
            style={i === 0 ? { color: brandColor, borderBottom: `2px solid ${brandColor}` } : {}}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Services grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          {services.length ? services.map((s: any, i: number) => (
            <div key={i} className="rounded-xl border p-3 flex flex-col gap-1.5">
              <p className="text-xs font-medium leading-tight">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.price}</p>
              {s.type && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded self-start capitalize"
                  style={{ background: bg, color: brandColor }}
                >
                  {s.type}
                </span>
              )}
            </div>
          )) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-3 animate-pulse">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2.5 bg-muted rounded w-1/2 mt-1.5" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save CTA */}
      <div className="px-5 pb-8 pt-3 shrink-0 border-t bg-background">
        <Button
          onClick={onSave}
          className="w-full h-11 text-white font-medium"
          style={{ background: brandColor }}
        >
          👌 Looking good · Save
        </Button>
      </div>
    </div>
  )
}

// ─── Minimal shared header ────────────────────────────────────────────────────

function Header() {
  const { signOut } = useAuth()
  return (
    <header className="shrink-0 border-b bg-muted/40 relative z-20">
      <div className="max-w-3xl mx-auto px-6 h-10 flex items-center justify-between">
        <span className="text-base font-semibold tracking-tight select-none">
          <span className="text-foreground/80">Forge</span>
          <span className="text-emerald-500 dark:text-emerald-400">fly</span>
        </span>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => signOut()}>
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </header>
  )
}
