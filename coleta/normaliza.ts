import type { Coleta, Dia } from './tipos.ts'

/** "Vila Nova Conceição" -> "vila nova conceicao" */
export function chaveTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function turnoDe(periodo: unknown): Coleta['turno'] {
  if (typeof periodo !== 'string') return undefined
  const p = periodo.trim().toUpperCase()
  if (p === 'DIURNO') return 'diurno'
  if (p === 'NOTURNO') return 'noturno'
  return undefined
}

const HORA = /^(\d{1,2}):(\d{2})$/

export function ehHora(s: unknown): s is string {
  return typeof s === 'string' && HORA.test(s.trim())
}

/** Diferença máxima entre o primeiro e o último horário para ainda dizer "a partir das X". */
export const FAIXA_MAX_MIN = 90

function fmtHora(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${h}h${m === 0 ? '' : String(m).padStart(2, '0')}`
}

/**
 * Texto do horário para o morador, a partir das horas publicadas.
 * - Diferença entre a hora mais cedo e a mais tarde <= 1h30: "a partir das X", com X arredondado
 *   para baixo à meia hora (o morador coloca o lixo antes do caminhão).
 * - Diferença maior: "entre X e Y", com X arredondado para baixo e Y para cima, à meia hora.
 * No turno noturno, horas da madrugada (antes das 12h) contam como depois da meia-noite:
 * 23:50 vem antes de 00:35.
 */
export function textoHorario(horas: string[], turno: Coleta['turno']): string | undefined {
  const minutos = horas
    .filter(ehHora)
    .map((h) => {
      const m = HORA.exec(h.trim())!
      let t = Number(m[1]) * 60 + Number(m[2])
      if (turno === 'noturno' && t < 12 * 60) t += 24 * 60
      return t
    })
  if (minutos.length === 0) return undefined
  const menor = Math.min(...minutos)
  const maior = Math.max(...minutos)
  const ini = Math.floor(menor / 30) * 30
  if (maior - menor <= FAIXA_MAX_MIN) return `a partir das ${fmtHora(ini)}`
  const fim = Math.ceil(maior / 30) * 30
  return `entre ${fmtHora(ini)} e ${fmtHora(fim)}`
}

/** Monta uma Coleta; devolve undefined se não houver nenhum dia. */
export function montaColeta(
  dias: Dia[],
  turno: Coleta['turno'],
  horarios: Partial<Record<Dia, string>>,
): Coleta | undefined {
  if (dias.length === 0) return undefined
  const c: Coleta = { dias }
  if (turno) c.turno = turno
  const horas = Object.values(horarios).filter(ehHora)
  if (horas.length > 0) {
    c.horarios = horarios
    const texto = textoHorario(horas, turno)
    if (texto) c.horario = texto
  }
  return c
}

export function soDigitos(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\D/g, '') : ''
}

/** CEP de 8 dígitos dentro das faixas da capital: 01000-000 a 05999-999 e 08000-000 a 08499-999. */
export function cepValido(cep: string): boolean {
  if (!/^\d{8}$/.test(cep)) return false
  const p = Number(cep.slice(0, 5))
  return (p >= 1000 && p <= 5999) || (p >= 8000 && p <= 8499)
}
