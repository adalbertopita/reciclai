import { describe, expect, it } from 'vitest'
import { cepValido, chaveTexto, textoHorario } from './normaliza.ts'

describe('textoHorario', () => {
  it.each([
    [['07:30'], 'diurno', 'a partir das 7h30'],
    [['12:49'], 'diurno', 'a partir das 12h30'],
    [['20:31', '21:43', '21:59'], 'noturno', 'a partir das 20h30'], // diferença 1h28
    [['20:00', '21:30'], 'noturno', 'a partir das 20h'], // exatamente 1h30
    [['20:00', '21:31'], 'noturno', 'entre 20h e 22h'], // 1h31
    [['22:00', '20:31', '22:40', '20:35', '21:43', '21:21'], 'noturno', 'entre 20h30 e 23h'],
    [['01:35', '01:15', '01:05', '00:20', '00:55', '01:10'], 'noturno', 'a partir das 0h'],
    [['23:50', '02:00'], 'noturno', 'entre 23h30 e 2h'], // atravessa a meia-noite
    [['20:30', '01:35'], 'noturno', 'entre 20h30 e 2h'],
  ] as const)('%j (%s) -> %s', (horas, turno, texto) => {
    expect(textoHorario([...horas], turno)).toBe(texto)
  })

  it('sem hora válida devolve undefined', () => {
    expect(textoHorario(['NOTURNO', '-'], 'noturno')).toBeUndefined()
  })
})

describe('cepValido', () => {
  it.each([
    ['01000000', true],
    ['05999999', true],
    ['08499999', true],
    ['08500000', false],
    ['06000000', false],
    ['00475210', false],
    ['0130808', false],
  ])('%s -> %s', (cep, ok) => expect(cepValido(cep)).toBe(ok))
})

describe('chaveTexto', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(chaveTexto('  Vila Nova Conceição ')).toBe('vila nova conceicao')
    expect(chaveTexto('ALTO DA MOÓCA')).toBe('alto da mooca')
  })
})
