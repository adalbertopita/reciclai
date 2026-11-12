/**
 * Loga (Centro, Norte, Oeste e parte da Leste).
 * API: GET https://webservices.loga.com.br/sgo/eresiduos/BuscaPorLatLng?distance&lat&lng&distanceEBVidro
 * Sem headers obrigatórios. Fora da área responde {"naoAtendido":true}. Detalhes no CLAUDE.md.
 */
import { montaColeta, turnoDe, soDigitos, cepValido } from '../normaliza.ts'
import type { Coleta, Dia, FonteGeo, Ponto, Trecho } from '../tipos.ts'

export const URL_API = 'https://webservices.loga.com.br/sgo/eresiduos/BuscaPorLatLng'
export const URL_OFICIAL = 'https://www.loga.com.br/pesquisa-de-coleta/'

const CAMPOS: [Dia, string][] = [
  ['seg', 'Seg'],
  ['ter', 'Ter'],
  ['qua', 'Qua'],
  ['qui', 'Qui'],
  ['sex', 'Sex'],
  ['sab', 'Sab'],
  ['dom', 'Dom'],
]

const TIPOS: Record<string, string> = {
  R: 'Rua',
  AV: 'Avenida',
  AL: 'Alameda',
  TV: 'Travessa',
  PC: 'Praça',
  VD: 'Viaduto',
  VL: 'Vila',
  VLA: 'Viela',
  LRG: 'Largo',
  TUN: 'Túnel',
  PSG: 'Passagem',
  PRQ: 'Parque',
  LD: 'Ladeira',
  BC: 'Beco',
  TER: 'Terminal',
  V: 'Via',
  ES: 'Estrada',
}

interface ServicoLoga {
  Periodo?: string | null
  Setor?: string | null
  ConsultaMunicipeHideHorario?: boolean | null
  ConsultaMunicipeSetorEmRevisao?: boolean | null
  [k: string]: unknown
}

interface LogradouroLoga {
  Tipo?: string | null
  Titulo?: string | null
  Preposicao?: string | null
  Logradouro?: string | null
  Subprefeitura?: string | null
  Cep?: string | null
  Domiciliar?: ServicoLoga | null
  Seletiva?: ServicoLoga | null
  Mecanizada?: ServicoLoga | null
}

function nomeLogradouro(l: LogradouroLoga): string {
  const tipo = (l.Tipo ?? '').trim()
  const partes = [TIPOS[tipo] ?? tipo, l.Titulo, l.Preposicao, l.Logradouro]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
  return partes.join(' ')
}

export function coletaLoga(s: ServicoLoga | null | undefined): Coleta | undefined {
  if (!s) return undefined
  const esconde = s.ConsultaMunicipeHideHorario === true || s.ConsultaMunicipeSetorEmRevisao === true
  const dias: Dia[] = []
  const horarios: Partial<Record<Dia, string>> = {}
  for (const [dia, sufixo] of CAMPOS) {
    if (s[`Has${sufixo}`] !== true) continue
    dias.push(dia)
    const h = s[`Hora${sufixo}`]
    if (!esconde && typeof h === 'string' && h.trim()) horarios[dia] = h.trim()
  }
  return montaColeta(dias, turnoDe(s.Periodo), horarios)
}

export function parseLoga(json: unknown): Trecho[] {
  const j = json as { naoAtendido?: boolean; found?: boolean; result?: { Logradouros?: LogradouroLoga[] } }
  if (!j || j.naoAtendido || !j.found) return []
  const lista = j.result?.Logradouros ?? []
  const saida: Trecho[] = []
  for (const l of lista) {
    const cep = soDigitos(l.Cep)
    if (!cepValido(cep)) continue
    const comum = coletaLoga(l.Domiciliar)
    const seletiva = coletaLoga(l.Seletiva)
    const conteiner = !!l.Mecanizada
    if (!comum && !seletiva && !conteiner) continue
    const setorComum = l.Domiciliar?.Setor ?? undefined
    const setorSeletiva = l.Seletiva?.Setor ?? undefined
    const logradouro = nomeLogradouro(l)
    const t: Trecho = {
      empresa: 'Loga',
      id: ['L', cep, logradouro, setorComum ?? '', setorSeletiva ?? '', conteiner ? 'M' : ''].join('|'),
      logradouro,
      ceps: [{ cep }],
    }
    if (l.Subprefeitura) t.subprefeitura = l.Subprefeitura
    if (setorComum) t.setorComum = setorComum
    if (setorSeletiva) t.setorSeletiva = setorSeletiva
    if (comum) t.comum = comum
    if (seletiva) t.seletiva = seletiva
    if (conteiner) t.conteiner = true
    saida.push(t)
  }
  return saida
}

export const loga: FonteGeo = {
  empresa: 'Loga',
  url(p: Ponto, raioM: number) {
    const q = new URLSearchParams({
      distance: String(Math.round(raioM)),
      lat: String(p.lat),
      lng: String(p.lng),
      distanceEBVidro: '0',
    })
    return `${URL_API}?${q}`
  },
  parse: parseLoga,
}
