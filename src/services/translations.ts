export type Translations = Record<string, string>

export async function loadPdfTranslations(): Promise<Translations> {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
  const locale = import.meta.env.VITE_PDF_LOCALE || 'cg'
  const response = await fetch(`${base}/vc/api/static/i18n?groups=GENERAL,BETS,BET_GROUPS&locale=${encodeURIComponent(locale)}`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('Nije uspelo učitavanje prevoda za PDF. Pokušajte ponovo.')
  const result = await response.json()
  if (result.status !== 'success' || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    throw new Error('Server nije vratio ispravne prevode za PDF.')
  }
  return Object.fromEntries(Object.entries(result.data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}
