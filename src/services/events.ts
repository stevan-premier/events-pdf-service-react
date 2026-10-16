export type ListType = 1 | 2

export async function generateDailyEvents(type: ListType): Promise<unknown> {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
  let response: Response
  try {
    response = await fetch(`${base}/api/events/generate_daily_events/${type}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(120_000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('Generisanje traje predugo. Pokušajte ponovo.', { cause: error })
    }
    throw new Error('Nije moguće povezivanje sa serverom. Proverite vezu i pokušajte ponovo.', { cause: error })
  }
  if (!response.ok) throw new Error(`Preuzimanje nije uspelo (greška ${response.status}). Pokušajte ponovo.`)
  let payload: unknown
  try { payload = await response.json() } catch {
    throw new Error('Server nije vratio podatke za listu. Proverite adresu API servera.')
  }
  if (payload && typeof payload === 'object' && 'status' in payload && payload.status === 'error') {
    throw new Error('Server nije uspeo da pripremi listu. Pokušajte ponovo.')
  }
  return payload
}
