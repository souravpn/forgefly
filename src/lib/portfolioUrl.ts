export function buildPortfolioUrl(slug: string): string {
  if (import.meta.env.PROD) return `https://${slug}.p.forgefly.io`
  return `${window.location.origin}/p/${slug}`
}

export function displayPortfolioUrl(slug: string): string {
  if (import.meta.env.PROD) return `${slug}.p.forgefly.io`
  return `${window.location.origin}/p/${slug}`
}
