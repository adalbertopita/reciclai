/**
 * Ecourbis (Sul e Leste).
 * API: GET https://apicoleta.ecourbis.com.br/coleta?lat&lng&dst&limit
 * Sem headers obrigatórios. ⚠️ limit padrão = 5: sempre mandar limit alto.
 * ⚠️ CEP vem sem os zeros à esquerda do sufixo ("04753-70" = 04753-070). Detalhes no CLAUDE.md.
 */
import { montaColeta, turnoDe, cepValido } from '../normaliza.ts'
import type { CepDoTrecho, Coleta, Dia, FonteGeo, Ponto, Trecho } from '../tipos.ts'

export const URL_API = 'https://apicoleta.ecourbis.com.br/coleta'
export const URL_OFICIAL = 'https://www.ecourbis.com.br/coleta/index.html'
export const LIMITE = 100_000
/**
 * ⚠️ A "distância" da API (dst e campo distancia) é ~1,65–1,81x a distância real, medida em 11/2026
 * nas quatro direções. Para cobrir um raio real R, pedimos dst = R x 1,9.
 */
export const FATOR_DST = 1.9

const DIAS_ECO: Dia[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

interface ServicoEco {
  frequencia?: string | null
  periodo?: string | null
  horarios?: Partial<Record<string, string | null>> | null
}

interface TrechoEco {
  id?: string | number | null
  endereco?: {
    logradouro?: string | null
    subprefeitura?: string | null
    distrito?: string | null
    cep_direita?: string | null
    cep_esquerda?: string | null
  } | null
  domiciliar?: ServicoEco | null
  seletiva?: ServicoEco | null
}

/**
 * Corrige o CEP da Ecourbis. A API remove os zeros à esquerda do sufixo:
 * "04753-70" -> "04753070", "04733-" -> "04733000", "04745-1" -> "04745001".
 * Devolve undefined para formato inesperado ou "00000-".
 */
export function corrigeCepEcourbis(bruto: unknown): string | undefined {
  if (typeof bruto !== 'string') return undefined
  const m = /^(\d{5})-?(\d{0,3})$/.exec(bruto.trim())
  if (!m) return undefined
  const cep = m[1]! + m[2]!.padStart(3, '0')
  return cepValido(cep) ? cep : undefined
}

export function coletaEcourbis(s: ServicoEco | null | undefined): Coleta | undefined {
  if (!s?.horarios) return undefined
  const turno = turnoDe(s.periodo)
  const dias: Dia[] = []
  const horarios: Partial<Record<Dia, string>> = {}
  for (const dia of DIAS_ECO) {
    const v = (s.horarios[dia] ?? '').trim()
    if (!v || v === '-') continue
    dias.push(dia)
    if (/^\d{1,2}:\d{2}$/.test(v)) horarios[dia] = v
  }
  return montaColeta(dias, turno, horarios)
}

function cepsDoTrecho(e: NonNullable<TrechoEco['endereco']>): CepDoTrecho[] {
  const dir = corrigeCepEcourbis(e.cep_direita)
  const esq = corrigeCepEcourbis(e.cep_esquerda)
  if (dir && esq && dir === esq) return [{ cep: dir }]
  const out: CepDoTrecho[] = []
  if (dir) out.push({ cep: dir, lado: 'direita' })
  if (esq) out.push({ cep: esq, lado: 'esquerda' })
  return out
}

export function parseEcourbis(json: unknown): Trecho[] {
  const lista = (json as { result?: TrechoEco[] } | null)?.result
  if (!Array.isArray(lista)) return []
  const saida: Trecho[] = []
  for (const r of lista) {
    if (r.id == null || !r.endereco) continue
    const ceps = cepsDoTrecho(r.endereco)
    if (ceps.length === 0) continue
    const comum = coletaEcourbis(r.domiciliar)
    const seletiva = coletaEcourbis(r.seletiva)
    if (!comum && !seletiva) continue
    const t: Trecho = {
      empresa: 'Ecourbis',
      id: `E|${r.id}`,
      logradouro: (r.endereco.logradouro ?? '').trim(),
      ceps,
    }
    if (r.endereco.subprefeitura) t.subprefeitura = r.endereco.subprefeitura
    if (r.endereco.distrito) t.distrito = r.endereco.distrito
    if (comum) t.comum = comum
    if (seletiva) t.seletiva = seletiva
    saida.push(t)
  }
  return saida
}

export const ecourbis: FonteGeo = {
  empresa: 'Ecourbis',
  url(p: Ponto, raioM: number) {
    const q = new URLSearchParams({
      lat: String(p.lat),
      lng: String(p.lng),
      dst: String(Math.round(raioM * FATOR_DST)),
      limit: String(LIMITE),
    })
    return `${URL_API}?${q}`
  },
  parse: parseEcourbis,
}
