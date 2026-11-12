import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseReciclaSampa } from './reciclasampa.ts'

const html = readFileSync(new URL('../../fixtures/reciclasampa/horarios-de-coleta.html', import.meta.url), 'utf8')

describe('Recicla Sampa', () => {
  const lista = parseReciclaSampa(html)

  it('lê 214 pares bairro+empresa (118 Loga, 96 Ecourbis), sem repetidos e sem o link do artigo', () => {
    // A página tem 217 linhas: 1 link de artigo + 2 repetições exatas (SAPOPEMBA e SOCORRO, Ecourbis duas vezes).
    expect(lista).toHaveLength(214)
    expect(lista.filter((b) => b.empresa === 'Loga')).toHaveLength(118)
    expect(lista.filter((b) => b.empresa === 'Ecourbis')).toHaveLength(96)
  })

  it('só Artur Alvim, Brooklin Paulista e Vila Nova Conceição têm as duas empresas', () => {
    const porChave = new Map<string, number>()
    for (const b of lista) porChave.set(b.chave, (porChave.get(b.chave) ?? 0) + 1)
    const duplas = [...porChave].filter(([, n]) => n > 1).map(([k]) => k).sort()
    expect(duplas).toEqual(['artur alvim', 'brooklin paulista', 'vila nova conceicao'])
  })

  it('normaliza a chave e mantém o nome publicado', () => {
    const b = lista.find((x) => x.bairro === 'ALTO DA MOÓCA')!
    expect(b).toEqual({ bairro: 'ALTO DA MOÓCA', chave: 'alto da mooca', empresa: 'Loga' })
  })

  it('bairros com as duas empresas aparecem para as duas', () => {
    const duplas = ['artur alvim', 'brooklin paulista', 'vila nova conceicao']
    for (const chave of duplas) {
      const emp = lista.filter((b) => b.chave === chave).map((b) => b.empresa).sort()
      expect(emp, chave).toEqual(['Ecourbis', 'Loga'])
    }
  })

  it('falha alto se a tabela sumir', () => {
    expect(() => parseReciclaSampa('<html></html>')).toThrow(/mudou/)
  })
})
