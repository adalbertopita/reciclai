/**
 * Cliente HTTP "educado": uma requisição por vez, pausa aleatória entre elas, User-Agent de browser,
 * e retry com espera progressiva.
 *
 * Variáveis de ambiente:
 *   PAUSA_MIN_MS (padrão 1000), PAUSA_MAX_MS (padrão 2000)
 */

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

export class ErroHttp extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`HTTP ${status} em ${url}`)
  }
}

export interface OpcoesHttp {
  pausaMinMs?: number
  pausaMaxMs?: number
  /** Espera base para 429/503: 30 s, 60 s, 90 s... */
  esperaSobrecargaMs?: number
  /** Tentativas para 429/503 antes de desistir. */
  maxTentativasSobrecarga?: number
  /** Tentativas extras para erro comum (rede, 5xx, JSON inválido). */
  tentativasErroComum?: number
  timeoutMs?: number
  fetch?: typeof fetch
  dormir?: (ms: number) => Promise<void>
  log?: (msg: string) => void
}

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function envNum(nome: string, padrao: number): number {
  const v = Number(process.env[nome])
  return Number.isFinite(v) && v >= 0 ? v : padrao
}

export function criaCliente(op: OpcoesHttp = {}) {
  const pausaMin = op.pausaMinMs ?? envNum('PAUSA_MIN_MS', 1000)
  const pausaMax = Math.max(pausaMin, op.pausaMaxMs ?? envNum('PAUSA_MAX_MS', 2000))
  const esperaSobrecarga = op.esperaSobrecargaMs ?? 30_000
  const maxSobrecarga = op.maxTentativasSobrecarga ?? 5
  const tentativasComum = op.tentativasErroComum ?? 2
  const timeoutMs = op.timeoutMs ?? 60_000
  const f = op.fetch ?? fetch
  const dormir = op.dormir ?? dormirReal
  const log = op.log ?? (() => {})
  let ultima = 0
  let fila: Promise<unknown> = Promise.resolve()

  async function pausa() {
    const alvo = pausaMin + Math.random() * (pausaMax - pausaMin)
    const decorrido = Date.now() - ultima
    if (ultima > 0 && decorrido < alvo) await dormir(alvo - decorrido)
  }

  async function umaVez(url: string, como: 'json' | 'texto'): Promise<unknown> {
    let sobrecarga = 0
    let comum = 0
    for (;;) {
      await pausa()
      ultima = Date.now()
      try {
        const r = await f(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/plain, */*' },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (r.status === 429 || r.status === 503) {
          sobrecarga++
          if (sobrecarga > maxSobrecarga) throw new ErroHttp(r.status, url)
          const espera = esperaSobrecarga * sobrecarga
          log(`HTTP ${r.status}; esperando ${espera / 1000}s (${sobrecarga}/${maxSobrecarga})`)
          await dormir(espera)
          continue
        }
        if (!r.ok) throw new ErroHttp(r.status, url)
        return como === 'json' ? await r.json() : await r.text()
      } catch (e) {
        if (e instanceof ErroHttp && (e.status === 429 || e.status === 503)) throw e
        if (e instanceof ErroHttp && e.status >= 400 && e.status < 500) throw e
        comum++
        if (comum > tentativasComum) throw e
        log(`erro (${(e as Error).message}); tentativa ${comum}/${tentativasComum}`)
      }
    }
  }

  /** GET que devolve JSON. Serializa as chamadas: nunca duas ao mesmo tempo. */
  function enfileira<T>(url: string, como: 'json' | 'texto'): Promise<T> {
    const p = fila.then(() => umaVez(url, como)) as Promise<T>
    fila = p.catch(() => {})
    return p
  }

  const getJson = (url: string) => enfileira<unknown>(url, 'json')
  const getTexto = (url: string) => enfileira<string>(url, 'texto')

  return { getJson, getTexto }
}

export type ClienteHttp = ReturnType<typeof criaCliente>
