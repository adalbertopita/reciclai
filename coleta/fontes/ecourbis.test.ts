import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { corrigeCepEcourbis, ecourbis, parseEcourbis } from './ecourbis.ts'

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../../fixtures/ecourbis/${n}`, import.meta.url), 'utf8'))

describe('corrigeCepEcourbis', () => {
  it.each([
    ['04753-70', '04753070'], // conferido no ViaCEP: Rua Humboldt = 04753-070
    ['04753-60', '04753060'], // Av. Padre José Maria = 04753-060
    ['04733-', '04733000'], // Av. Adolfo Pinheiro "até 195 ímpar" = 04733-000
    ['04745-1', '04745001'], // Alameda Santo Amaro lado par = 04745-001
    ['04745-0', '04745000'],
    ['04849-120', '04849120'],
  ])('%s -> %s', (bruto, cep) => {
    expect(corrigeCepEcourbis(bruto)).toBe(cep)
  })

  // 00475-210: erro de digitação real da Ecourbis (o outro lado do trecho é 04753-210); fora da capital.
  it.each(['00000-', '', 'abc', '0475-210', '00475-210', '13010-000', null, undefined])('rejeita %s', (bruto) => {
    expect(corrigeCepEcourbis(bruto)).toBeUndefined()
  })
})

describe('Ecourbis', () => {
  it('URL leva limit alto (padrão da API é 5) e dst corrigido pela distorção (~1,8x) da API', () => {
    const u = new URL(ecourbis.url({ lat: -23.65, lng: -46.7 }, 2000))
    expect(u.searchParams.get('limit')).toBe('100000')
    expect(u.searchParams.get('dst')).toBe('3800')
  })

  it('resposta vazia vira lista vazia', () => {
    expect(parseEcourbis(fx('coleta-vazio.json'))).toEqual([])
  })

  it('normaliza Rua Humboldt (fixture real): dias sem hora, só turno', () => {
    const t = parseEcourbis(fx('coleta-santo-amaro-d100.json')).find((x) => x.id === 'E|24219088')!
    expect(t.empresa).toBe('Ecourbis')
    expect(t.logradouro).toBe('Rua Humboldt')
    expect(t.ceps).toEqual([{ cep: '04753070' }])
    expect(t.distrito).toBe('SANTO AMARO')
    expect(t.comum).toEqual({ dias: ['seg', 'qua', 'sex'], turno: 'noturno' })
  })

  it('horário noturno que passa da meia-noite: mais cedo é 23h30 (23:50), não 0h', () => {
    const [t] = parseEcourbis({
      result: [
        {
          id: 1,
          endereco: { logradouro: 'Av X', cep_direita: '04753-60', cep_esquerda: '04753-60' },
          domiciliar: {
            periodo: 'NOTURNO',
            horarios: { seg: '23:50', ter: '23:35', qua: '00:15', qui: '23:40', sex: '00:05', sab: '00:40' },
          },
        },
      ],
    })
    expect(t!.comum?.horario).toBe('a partir das 23h30')
    expect(t!.comum?.dias).toEqual(['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
  })

  it('lados com CEPs diferentes viram duas entradas com lado', () => {
    const [t] = parseEcourbis({
      result: [
        {
          id: 2,
          endereco: { logradouro: 'Alameda Santo Amaro', cep_direita: '04745-0', cep_esquerda: '04745-1' },
          seletiva: { periodo: 'DIURNO', horarios: { qui: '07:30', seg: '-' } },
        },
      ],
    })
    expect(t!.ceps).toEqual([
      { cep: '04745000', lado: 'direita' },
      { cep: '04745001', lado: 'esquerda' },
    ])
    expect(t!.comum).toBeUndefined()
    expect(t!.seletiva).toEqual({ dias: ['qui'], turno: 'diurno', horario: 'a partir das 7h30', horarios: { qui: '07:30' } })
  })

  it('fixture de 2 km: CEPs de 8 dígitos, alguma coleta e ids únicos', () => {
    const ts = parseEcourbis(fx('coleta-santo-amaro-d2000.json'))
    expect(ts.length).toBeGreaterThan(500)
    for (const t of ts) {
      for (const c of t.ceps) expect(c.cep).toMatch(/^\d{8}$/)
      expect(t.comum || t.seletiva).toBeTruthy()
    }
    expect(new Set(ts.map((t) => t.id)).size).toBe(ts.length)
  })
})
