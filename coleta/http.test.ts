import { describe, expect, it } from 'vitest'
import { criaCliente, ErroHttp } from './http.ts'

function resp(status: number, corpo: unknown = {}) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
}

function cliente(respostas: (Response | Error)[]) {
  const esperas: number[] = []
  const urls: string[] = []
  const c = criaCliente({
    pausaMinMs: 0,
    pausaMaxMs: 0,
    fetch: (async (url: string) => {
      urls.push(url)
      const r = respostas.shift()
      if (!r) throw new Error('sem resposta')
      if (r instanceof Error) throw r
      return r
    }) as typeof fetch,
    dormir: async (ms) => {
      esperas.push(ms)
    },
  })
  return { c, esperas, urls }
}

describe('cliente http', () => {
  it('429/503 esperam 30 s, 60 s... e depois seguem', async () => {
    const { c, esperas } = cliente([resp(429), resp(503), resp(200, { ok: 1 })])
    await expect(c.getJson('u')).resolves.toEqual({ ok: 1 })
    expect(esperas).toEqual([30_000, 60_000])
  })

  it('erro comum tenta mais 2 vezes e então falha', async () => {
    const { c, urls } = cliente([new Error('rede'), resp(500), new Error('rede'), resp(200)])
    await expect(c.getJson('u')).rejects.toThrow('rede')
    expect(urls).toHaveLength(3)
  })

  it('erro comum seguido de sucesso', async () => {
    const { c } = cliente([resp(502), resp(200, [1])])
    await expect(c.getJson('u')).resolves.toEqual([1])
  })

  it('404 não repete', async () => {
    const { c, urls } = cliente([resp(404)])
    await expect(c.getJson('u')).rejects.toBeInstanceOf(ErroHttp)
    expect(urls).toHaveLength(1)
  })

  it('uma requisição por vez, na ordem', async () => {
    const ordem: string[] = []
    let ativas = 0
    const c = criaCliente({
      pausaMinMs: 0,
      pausaMaxMs: 0,
      dormir: async () => {},
      fetch: (async (url: string) => {
        ativas++
        expect(ativas).toBe(1)
        await new Promise((r) => setTimeout(r, 5))
        ordem.push(url)
        ativas--
        return resp(200)
      }) as typeof fetch,
    })
    await Promise.all([c.getJson('a'), c.getJson('b'), c.getJson('c')])
    expect(ordem).toEqual(['a', 'b', 'c'])
  })
})
