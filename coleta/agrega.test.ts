import { describe, expect, it } from 'vitest'
import { agrega, nomeExibicao } from './agrega.ts'
import type { Trecho } from './tipos.ts'

const trecho = (p: Partial<Trecho> & { id: string; cep: string }): Trecho => ({
  empresa: 'Ecourbis',
  logradouro: 'Rua X',
  ceps: [{ cep: p.cep }],
  ...p,
})

describe('nomeExibicao', () => {
  it.each([
    ['Rua PROF OTAVIO MENDES', 'Rua Prof Otavio Mendes'],
    ['Rua PLINIO FIGUEIREDO', 'Rua Plinio Figueiredo'],
    ['Praça DAS GUIANAS', 'Praça das Guianas'],
    ['Avenida Padre José Maria', 'Avenida Padre José Maria'],
  ])('%s -> %s', (a, b) => expect(nomeExibicao(a)).toBe(b))
})

describe('agrega', () => {
  it('junta trechos do mesmo CEP com mesmos dias/turno, e o horário considera todas as horas', () => {
    const r = agrega([
      trecho({ id: '1', cep: '04753060', comum: { dias: ['seg', 'ter'], turno: 'noturno', horarios: { seg: '00:35', ter: '02:00' } } }),
      trecho({ id: '2', cep: '04753060', comum: { dias: ['seg', 'ter'], turno: 'noturno', horarios: { seg: '23:50', ter: '02:05' } } }),
    ])
    const arq = r.arquivos.get('04753')!
    const [op] = arq.ceps['04753060']!
    expect(arq.ceps['04753060']).toHaveLength(1)
    expect(op!.ruas).toBeUndefined()
    expect(arq.setores[op!.setor]).toEqual({
      empresa: 'Ecourbis',
      comum: { dias: ['seg', 'ter'], turno: 'noturno', horario: 'entre 23h30 e 2h30' }, // 23:50 ... 02:05
    })
  })

  it('CEP com dias diferentes conforme a rua vira duas opções com o nome da rua', () => {
    const r = agrega([
      trecho({ id: 'a', cep: '01327010', empresa: 'Loga', logradouro: 'Rua AMADEU AMARAL', comum: { dias: ['seg'], turno: 'noturno' } }),
      trecho({ id: 'b', cep: '01327010', empresa: 'Loga', logradouro: 'Praça AMADEU AMARAL', seletiva: { dias: ['ter'], turno: 'diurno' } }),
    ])
    const ops = r.arquivos.get('01327')!.ceps['01327010']!
    expect(ops.map((o) => o.ruas)).toEqual([['Rua Amadeu Amaral'], ['Praça Amadeu Amaral']])
    expect(r.totais.cepsComOpcoes).toBe(1)
  })

  it('trechos às 20h30 e à 1h35 no mesmo CEP viram "entre 20h30 e 2h" (caso 04745001)', () => {
    const r = agrega([
      trecho({ id: '1', cep: '04745001', comum: { dias: ['seg'], turno: 'noturno', horarios: { seg: '20:35' } } }),
      trecho({ id: '2', cep: '04745001', comum: { dias: ['seg'], turno: 'noturno', horarios: { seg: '01:35' } } }),
    ])
    const arq = r.arquivos.get('04745')!
    expect(arq.setores[arq.ceps['04745001']![0]!.setor]!.comum!.horario).toBe('entre 20h30 e 2h')
  })

  it('ruas diferentes com o mesmo horário não geram pergunta', () => {
    const c = { dias: ['qua' as const], turno: 'diurno' as const }
    const r = agrega([
      trecho({ id: 'a', cep: '01000000', logradouro: 'Rua A', comum: c }),
      trecho({ id: 'b', cep: '01000000', logradouro: 'Rua B', comum: c }),
    ])
    expect(r.arquivos.get('01000')!.ceps['01000000']).toHaveLength(1)
  })

  it('trecho com CEP por lado entra nos dois CEPs; repetição de id conta uma vez', () => {
    const t: Trecho = {
      empresa: 'Ecourbis', id: 'x', logradouro: 'Alameda Santo Amaro',
      ceps: [{ cep: '04745000', lado: 'direita' }, { cep: '04745001', lado: 'esquerda' }],
      seletiva: { dias: ['qui'], turno: 'diurno' },
    }
    const r = agrega([t, t])
    expect(Object.keys(r.arquivos.get('04745')!.ceps)).toEqual(['04745000', '04745001'])
    expect(r.totais.trechos.Ecourbis).toBe(1)
  })

  it('ids de setor são estáveis (hash do conteúdo)', () => {
    const t = trecho({ id: '1', cep: '04000000', comum: { dias: ['seg'] } })
    const a = agrega([t]).arquivos.get('04000')!
    const b = agrega([t]).arquivos.get('04000')!
    expect(Object.keys(a.setores)).toEqual(Object.keys(b.setores))
  })
})
