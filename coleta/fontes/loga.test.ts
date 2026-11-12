import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loga, parseLoga } from './loga.ts'

const fx = (n: string) => JSON.parse(readFileSync(new URL(`../../fixtures/loga/${n}`, import.meta.url), 'utf8'))

describe('Loga', () => {
  it('monta URL com raio e sem Ecobox de vidro', () => {
    const u = new URL(loga.url({ lat: -23.5614, lng: -46.6559 }, 2000))
    expect(u.origin + u.pathname).toBe('https://webservices.loga.com.br/sgo/eresiduos/BuscaPorLatLng')
    expect(u.searchParams.get('distance')).toBe('2000')
    expect(u.searchParams.get('distanceEBVidro')).toBe('0')
  })

  it('naoAtendido vira lista vazia', () => {
    expect(parseLoga(fx('busca-latlng-nao-atendido.json'))).toEqual([])
  })

  it('normaliza Rua Plínio Figueiredo (fixture real)', () => {
    const t = parseLoga(fx('busca-latlng-paulista-d100.json')).find((x) => x.ceps[0]?.cep === '01308080')!
    expect(t).toBeDefined()
    expect(t.empresa).toBe('Loga')
    expect(t.logradouro).toBe('Rua PLINIO FIGUEIREDO')
    expect(t.setorComum).toBe('SE09')
    expect(t.setorSeletiva).toBe('SE25')
    expect(t.comum).toEqual({
      dias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
      turno: 'noturno',
      horario: 'entre 20h30 e 23h',
      horarios: { seg: '22:00', ter: '20:31', qua: '22:40', qui: '20:35', sex: '21:43', sab: '21:21' },
    })
    expect(t.seletiva).toEqual({
      dias: ['ter'],
      turno: 'diurno',
      horario: 'a partir das 12h30',
      horarios: { ter: '12:49' },
    })
  })

  it('título entra no nome (PROF OTAVIO MENDES)', () => {
    const t = parseLoga(fx('busca-latlng-paulista-d100.json')).find((x) => x.ceps[0]?.cep === '01332040')!
    expect(t.logradouro).toBe('Rua PROF OTAVIO MENDES')
  })

  it('fixture de 2 km: todo trecho tem CEP de 8 dígitos e alguma coleta; ids únicos', () => {
    const ts = parseLoga(fx('busca-latlng-paulista-d2000.json'))
    expect(ts.length).toBeGreaterThan(300)
    for (const t of ts) {
      expect(t.ceps[0]!.cep).toMatch(/^\d{8}$/)
      expect(t.comum || t.seletiva || t.conteiner).toBeTruthy()
    }
    expect(new Set(ts.map((t) => t.id)).size).toBe(ts.length)
  })

  it('Domiciliar null mantém só a seletiva', () => {
    const [t] = parseLoga({
      found: true,
      result: {
        Logradouros: [
          {
            Tipo: 'VD', Titulo: 'PROF', Logradouro: 'BERNARDINO TRANCHESI', Cep: '01333070', Domiciliar: null, Mecanizada: null,
            Seletiva: { Periodo: 'DIURNO', Setor: 'SE05', HasTer: true, HoraTer: '09:32' },
          },
        ],
      },
    })
    expect(t!.comum).toBeUndefined()
    expect(t!.logradouro).toBe('Viaduto PROF BERNARDINO TRANCHESI')
    expect(t!.seletiva?.dias).toEqual(['ter'])
  })

  it('respeita ConsultaMunicipeHideHorario: dias sem hora', () => {
    const [t] = parseLoga({
      found: true,
      result: {
        Logradouros: [
          {
            Tipo: 'R', Logradouro: 'X', Cep: '01000000',
            Domiciliar: { Periodo: 'NOTURNO', HasSeg: true, HoraSeg: '22:00', ConsultaMunicipeHideHorario: true },
          },
        ],
      },
    })
    expect(t!.comum).toEqual({ dias: ['seg'], turno: 'noturno' })
  })

  it('descarta CEP vazio', () => {
    expect(
      parseLoga({ found: true, result: { Logradouros: [{ Cep: '', Domiciliar: { HasSeg: true } }] } }),
    ).toEqual([])
  })
})
