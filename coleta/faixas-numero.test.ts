import { describe, expect, it } from 'vitest'
import { empresaDoNumero, faixasDoLado, type FaixasCep } from './faixas-numero.ts'
import type { Empresa } from './tipos.ts'

function contador(regra: (n: number) => Empresa) {
  const consultados: number[] = []
  return {
    consultados,
    classifica: async (n: number) => {
      consultados.push(n)
      return regra(n)
    },
  }
}

const impares = (ate: number) => Array.from({ length: Math.ceil(ate / 2) }, (_, k) => 2 * k + 1)

describe('faixasDoLado', () => {
  it('acha a troca de empresa com poucas consultas', async () => {
    const nums = impares(999) // 500 números
    const c = contador((n) => (n <= 431 ? 'Loga' : 'Ecourbis'))
    const f = await faixasDoLado(nums, c.classifica)
    expect(f).toEqual([
      [1, 431, 'Loga'],
      [433, 999, 'Ecourbis'],
    ])
    expect(c.consultados.length).toBeLessThan(15)
    expect(new Set(c.consultados).size).toBe(c.consultados.length) // nunca repete
  })

  it('lado todo de uma empresa: pontas + conferência do meio e quartis', async () => {
    const c = contador(() => 'Loga')
    const f = await faixasDoLado(impares(199), c.classifica)
    expect(f).toEqual([[1, 199, 'Loga']])
    expect(c.consultados.length).toBe(5)
  })

  it('ilha no meio (pontas iguais) é pega pela conferência', async () => {
    const c = contador((n) => (n >= 81 && n <= 121 ? 'Ecourbis' : 'Loga'))
    const f = await faixasDoLado(impares(199), c.classifica)
    expect(f).toEqual([
      [1, 79, 'Loga'],
      [81, 121, 'Ecourbis'],
      [123, 199, 'Loga'],
    ])
  })

  it('poucos números: classifica todos', async () => {
    const c = contador((n) => (n < 10 ? 'Ecourbis' : 'Loga'))
    expect(await faixasDoLado([2, 8, 40], c.classifica)).toEqual([
      [2, 8, 'Ecourbis'],
      [40, 40, 'Loga'],
    ])
    expect(c.consultados).toEqual([2, 8, 40])
  })

  it('lado vazio', async () => {
    expect(await faixasDoLado([], async () => 'Loga')).toEqual([])
  })
})

describe('empresaDoNumero', () => {
  const f: FaixasCep = {
    p: [
      [2, 498, 'Loga'],
      [520, 900, 'Ecourbis'],
    ],
    i: [[1, 999, 'Loga']],
  }
  it('dentro das faixas', () => {
    expect(empresaDoNumero(f, 100)).toBe('Loga')
    expect(empresaDoNumero(f, 520)).toBe('Ecourbis')
    expect(empresaDoNumero(f, 77)).toBe('Loga')
  })
  it('fora do que o CNEFE cobre: não sabe', () => {
    expect(empresaDoNumero(f, 2000)).toBeNull()
    expect(empresaDoNumero(f, 1501)).toBeNull()
    expect(empresaDoNumero({ p: [[68, 208, 'Ecourbis']], i: [] }, 10)).toBeNull()
  })
  it('vão entre faixas da mesma empresa: essa empresa', () => {
    expect(empresaDoNumero({ p: [[2, 10, 'Loga'], [20, 30, 'Ecourbis'], [40, 50, 'Loga']], i: [] }, 14)).toBeNull()
    expect(empresaDoNumero({ p: [[2, 10, 'Loga'], [20, 30, 'Loga']], i: [] }, 14)).toBe('Loga')
  })
  it('no vão entre empresas diferentes: não sabe', () => {
    expect(empresaDoNumero(f, 510)).toBeNull()
  })
  it('lado sem dado: não sabe', () => {
    expect(empresaDoNumero({ p: [], i: [] }, 10)).toBeNull()
  })
})
