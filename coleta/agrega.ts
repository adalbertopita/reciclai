/**
 * Agregação pura: trechos normalizados -> estrutura dos arquivos do site.
 *
 * Arquivo site/dados/cep/<5 dígitos>.json:
 * {
 *   "setores": { "<id>": { empresa, comum?, seletiva?, conteiner? } },   // perfis usados neste arquivo
 *   "ceps":    { "<8 dígitos>": [ { "setor": "<id>", "ruas"?: ["Rua X", ...] } ] }
 * }
 * Um CEP com mais de uma opção tem horários diferentes conforme a rua (ex.: praça e rua com o mesmo CEP).
 * Nesse caso, "ruas" diz a qual logradouro cada opção vale. Com uma opção só, "ruas" é omitido.
 */
import { createHash } from 'node:crypto'
import { montaColeta, textoHorario, ehHora } from './normaliza.ts'
import type { Coleta, Dia, Empresa, Trecho } from './tipos.ts'

export interface SetorSaida {
  empresa: Empresa
  comum?: Omit<Coleta, 'horarios'>
  seletiva?: Omit<Coleta, 'horarios'>
  conteiner?: true
}
export interface OpcaoCep {
  setor: string
  ruas?: string[]
}
export interface ArquivoPrefixo {
  setores: Record<string, SetorSaida>
  ceps: Record<string, OpcaoCep[]>
}

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no'])

/** "Rua PROF OTAVIO MENDES" -> "Rua Prof Otavio Mendes". Nomes já em caixa mista ficam como estão. */
export function nomeExibicao(s: string): string {
  if (s !== s.toUpperCase() && /[a-z]/.test(s.split(' ').slice(1).join(' '))) return s
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

function minutos(h: string, turno: Coleta['turno']): number {
  const [hh, mm] = h.split(':').map(Number)
  let t = hh! * 60 + mm!
  if (turno === 'noturno' && t < 12 * 60) t += 24 * 60
  return t
}

const assinaturaColeta = (c?: Coleta) => (c ? `${c.dias.join(',')}/${c.turno ?? ''}` : '-')

/** Junta duas coletas com os mesmos dias e turno (o texto do horário é recalculado em setorDe com todas as horas). */
function juntaColeta(a: Coleta | undefined, b: Coleta | undefined): Coleta | undefined {
  if (!a || !b) return a ?? b
  const h: Partial<Record<Dia, string>> = { ...a.horarios }
  for (const [dia, hora] of Object.entries(b.horarios ?? {}) as [Dia, string][]) {
    const atual = h[dia]
    if (!atual || minutos(hora, b.turno) < minutos(atual, a.turno)) h[dia] = hora
  }
  return montaColeta(a.dias, a.turno, h)
}

const horasDe = (c?: Coleta) => Object.values(c?.horarios ?? {}).filter(ehHora)

interface Grupo {
  empresa: Empresa
  comum?: Coleta
  seletiva?: Coleta
  /** Todas as horas de todos os trechos juntados, para o texto "entre X e Y". */
  horasComum: string[]
  horasSeletiva: string[]
  conteiner: boolean
  ruas: Set<string>
}

function setorDe(g: Grupo): SetorSaida {
  const tira = (c: Coleta | undefined, horas: string[]) => {
    if (!c) return undefined
    const { horarios: _h, horario: _t, ...resto } = c
    const texto = textoHorario(horas, c.turno)
    return texto ? { ...resto, horario: texto } : resto
  }
  const s: SetorSaida = { empresa: g.empresa }
  const comum = tira(g.comum, g.horasComum)
  const seletiva = tira(g.seletiva, g.horasSeletiva)
  if (comum) s.comum = comum
  if (seletiva) s.seletiva = seletiva
  if (g.conteiner) s.conteiner = true
  return s
}

export function idSetor(s: SetorSaida): string {
  return createHash('sha1').update(JSON.stringify(s)).digest('hex').slice(0, 8)
}

export interface Resultado {
  arquivos: Map<string, ArquivoPrefixo>
  totais: {
    trechos: Record<Empresa, number>
    ceps: number
    cepsComOpcoes: number
    cepsPorEmpresa: Record<Empresa, number>
    cepsNasDuasEmpresas: number
    setores: number
  }
}

export function agrega(entrada: Iterable<Trecho>): Resultado {
  // 1. dedup por id
  const porId = new Map<string, Trecho>()
  for (const t of entrada) porId.set(t.id, t)

  // 2. CEP -> grupos por assinatura (empresa + dias/turno de cada coleta + contêiner)
  const porCep = new Map<string, Map<string, Grupo>>()
  for (const t of porId.values()) {
    const assin = [t.empresa, assinaturaColeta(t.comum), assinaturaColeta(t.seletiva), t.conteiner ? 'M' : ''].join('|')
    for (const { cep } of t.ceps) {
      let grupos = porCep.get(cep)
      if (!grupos) porCep.set(cep, (grupos = new Map()))
      const g = grupos.get(assin)
      if (!g) {
        grupos.set(assin, {
          empresa: t.empresa,
          comum: t.comum,
          seletiva: t.seletiva,
          conteiner: !!t.conteiner,
          horasComum: horasDe(t.comum),
          horasSeletiva: horasDe(t.seletiva),
          ruas: new Set([nomeExibicao(t.logradouro)]),
        })
      } else {
        g.comum = juntaColeta(g.comum, t.comum)
        g.seletiva = juntaColeta(g.seletiva, t.seletiva)
        g.horasComum.push(...horasDe(t.comum))
        g.horasSeletiva.push(...horasDe(t.seletiva))
        g.ruas.add(nomeExibicao(t.logradouro))
      }
    }
  }

  // 3. monta arquivos por prefixo
  const arquivos = new Map<string, ArquivoPrefixo>()
  const todosSetores = new Set<string>()
  const totais: Resultado['totais'] = {
    trechos: { Loga: 0, Ecourbis: 0 },
    ceps: 0,
    cepsComOpcoes: 0,
    cepsPorEmpresa: { Loga: 0, Ecourbis: 0 },
    cepsNasDuasEmpresas: 0,
    setores: 0,
  }
  for (const t of porId.values()) totais.trechos[t.empresa]++

  for (const cep of [...porCep.keys()].sort()) {
    const grupos = [...porCep.get(cep)!.values()]
    const prefixo = cep.slice(0, 5)
    let arq = arquivos.get(prefixo)
    if (!arq) arquivos.set(prefixo, (arq = { setores: {}, ceps: {} }))
    const opcoes: OpcaoCep[] = []
    const vistos = new Set<string>()
    for (const g of grupos) {
      const s = setorDe(g)
      const id = idSetor(s)
      if (vistos.has(id)) continue
      vistos.add(id)
      arq.setores[id] = s
      todosSetores.add(id)
      opcoes.push({ setor: id, ruas: [...g.ruas].sort() })
    }
    if (opcoes.length === 1) delete opcoes[0]!.ruas
    else totais.cepsComOpcoes++
    arq.ceps[cep] = opcoes
    totais.ceps++
    const empresas = new Set(grupos.map((g) => g.empresa))
    for (const e of empresas) totais.cepsPorEmpresa[e]++
    if (empresas.size > 1) totais.cepsNasDuasEmpresas++
  }
  totais.setores = todosSetores.size
  return { arquivos, totais }
}
