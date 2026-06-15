export type ChannelTier = 'now' | 'grow' | 'coming_soon'

export interface VisibilityChannel {
  id: string
  name: string
  description: string
  tier: ChannelTier
  kitKey?: string
}

export interface VisibilityPlaybook {
  presenceTier: string
  headline: string
  sub: string
  motionTag: string
  verticalTags: string[]
  channels: VisibilityChannel[]
}

export const PLAYBOOKS: Record<string, VisibilityPlaybook> = {
  b2b_creative: {
    presenceTier: 'b2b_creative',
    headline: 'You win clients by showing work, not talking about it.',
    sub: 'Your buyers are art directors and creative leads who scroll before they DM. Show up where they scroll.',
    motionTag: 'B2B',
    verticalTags: ['Creative', 'Portfolio-forward'],
    channels: [
      {
        id: 'behance_dribbble_bio',
        name: 'Behance / Dribbble bio',
        description: 'Profile bio + case study structure template that converts views into outreach.',
        tier: 'now',
        kitKey: 'behance_dribbble_bio',
      },
      {
        id: 'linkedin_kit',
        name: 'LinkedIn presence kit',
        description: 'Headline, About section, and Featured copy optimised for B2B creative buyers.',
        tier: 'now',
        kitKey: 'linkedin_kit',
      },
      {
        id: 'outreach_kit_entry',
        name: 'Cold outreach kit',
        description: 'Research a target company and generate a personalised multi-step outreach sequence.',
        tier: 'now',
        kitKey: null,
      },
      {
        id: 'seo_bio',
        name: 'Google / SEO bio',
        description: 'Keyword-aligned bio for Google Business and your personal site.',
        tier: 'grow',
        kitKey: 'seo_bio',
      },
      {
        id: 'reddit_signals',
        name: 'Reddit demand signals',
        description: 'Live r/gamedev, r/forhire, r/gamedesign posts where studios are looking for talent.',
        tier: 'coming_soon',
      },
    ],
  },

  b2c_local: {
    presenceTier: 'b2c_local',
    headline: 'Your clients are searching for someone exactly like you right now.',
    sub: 'Reviews, photos, and local presence convert searchers into bookings. Let\'s get you found.',
    motionTag: 'B2C',
    verticalTags: ['Local', 'Review-driven'],
    channels: [
      {
        id: 'instagram_kit',
        name: 'Instagram presence kit',
        description: 'Bio, highlights structure, and 5 caption templates that drive DMs.',
        tier: 'now',
        kitKey: 'instagram_kit',
      },
      {
        id: 'google_business',
        name: 'Google Business description',
        description: 'Services description, FAQ copy, and business summary for your Google listing.',
        tier: 'now',
        kitKey: 'google_business',
      },
      {
        id: 'wedding_profile',
        name: 'The Knot / WeddingWire profile',
        description: 'Profile blurb and package descriptions for wedding industry directories.',
        tier: 'now',
        kitKey: 'wedding_profile',
      },
      {
        id: 'nextdoor_intro',
        name: 'Nextdoor intro post',
        description: 'Neighborhood introduction post, ready to copy and paste.',
        tier: 'now',
        kitKey: 'nextdoor_intro',
      },
      {
        id: 'local_signals',
        name: 'Local community signals',
        description: 'Reddit local + Facebook group posts where people are actively looking for your services.',
        tier: 'coming_soon',
      },
    ],
  },

  b2b_professional: {
    presenceTier: 'b2b_professional',
    headline: 'Clients hire you on trust. Your job is to show up where trust is built.',
    sub: 'Professional services buyers Google you, check LinkedIn, and ask for referrals — in that order.',
    motionTag: 'B2B',
    verticalTags: ['Professional services', 'Trust-forward'],
    channels: [
      {
        id: 'linkedin_authority',
        name: 'LinkedIn authority kit',
        description: 'Full profile copy + 3 thought leadership post templates to build credibility.',
        tier: 'now',
        kitKey: 'linkedin_authority',
      },
      {
        id: 'google_yelp_pro',
        name: 'Google Business + Yelp description',
        description: 'Professional business description optimised for trust and conversion.',
        tier: 'now',
        kitKey: 'google_yelp_pro',
      },
      {
        id: 'alignable_referral',
        name: 'Alignable + referral intro',
        description: 'Alignable profile copy and a referral introduction message for your network.',
        tier: 'now',
        kitKey: 'alignable_referral',
      },
      {
        id: 'trust_kit',
        name: 'Trust signal + testimonial kit',
        description: 'Credentials callouts and a ready-to-send testimonial request template.',
        tier: 'grow',
        kitKey: 'trust_kit',
      },
      {
        id: 'pro_signals',
        name: 'Professional community signals',
        description: 'r/personalfinance, r/smallbusiness posts from people seeking your expertise.',
        tier: 'coming_soon',
      },
    ],
  },

  hybrid_professional: {
    presenceTier: 'hybrid_professional',
    headline: 'You work with both businesses and individuals. Show up where both look.',
    sub: 'Your ideal client is either Googling you or getting referred. You need both signals firing.',
    motionTag: 'Hybrid',
    verticalTags: ['B2B + B2C', 'Multi-channel'],
    channels: [
      {
        id: 'linkedin_kit',
        name: 'LinkedIn presence kit',
        description: 'Headline, About, and Featured copy for professional buyers.',
        tier: 'now',
        kitKey: 'linkedin_kit',
      },
      {
        id: 'google_business',
        name: 'Google Business description',
        description: 'Local + professional description that works for both individual and business clients.',
        tier: 'now',
        kitKey: 'google_business',
      },
      {
        id: 'trust_kit',
        name: 'Trust signal kit',
        description: 'Credentials, testimonial request template, and referral intro message.',
        tier: 'now',
        kitKey: 'trust_kit',
      },
      {
        id: 'seo_bio',
        name: 'SEO + directory bio',
        description: 'Keyword-aligned bio for Google and professional directories.',
        tier: 'grow',
        kitKey: 'seo_bio',
      },
      {
        id: 'hybrid_signals',
        name: 'Demand signals',
        description: 'Community posts from both businesses and individuals seeking your services.',
        tier: 'coming_soon',
      },
    ],
  },
}

export const PRESENCE_TIER_LABELS: Record<string, string> = {
  b2b_creative: 'B2B Creative',
  b2c_local: 'B2C Local',
  b2b_professional: 'B2B Professional',
  hybrid_professional: 'Hybrid Professional',
}

export const PERSONA_EXAMPLES: Record<string, string> = {
  b2b_creative: 'Graphic designer, UI/UX designer, illustrator, motion artist',
  b2c_local: 'Baker, photographer, wedding planner, home services',
  b2b_professional: 'CPA, consultant, bookkeeper, coach',
  hybrid_professional: 'Therapist, personal trainer, financial advisor',
}
