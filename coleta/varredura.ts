/**
 * Varredura por grade de coordenadas.
 *
 *   npm run varredura -- --area=cidade                 # varre (ou continua de onde parou)
 *   npm run varredura -- --area=amostra-loga --raio=1000
 *   npm run varredura -- --area=cidade --falhas        # repete só os itens de coleta/falhas.json
 *   --nome=x   grava em coleta/bruto/x.jsonl (padrão: o nome da área)
 *   --fontes=loga,ecourbis
 *   --mascara=<nome>:<fonte>  só pontos perto de onde <fonte> respondeu na varredura <nome> (lê <nome>.pontos.jsonl)
 *
 * Saída: coleta/bruto/<area>.jsonl, uma linha por trecho normalizado (com repetições entre pontos;
 *        a deduplicação acontece no gerar-dados).
 * Retomada: coleta/progresso.json, gravado a cada CHECKPOINT_A_CADA itens (padrão 5); apagado no fim.
 * Falhas: coleta/falhas.json.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AREAS, distanciaM, gerarGrade } from './grade.ts'
import { criaCliente } from './http.ts'
import { ecourbis } from './fontes/ecourbis.ts'
import { loga } from './fontes/loga.ts'
import type { FonteGeo, Ponto } from './tipos.ts'

const DIR = dirname(fileURLToPath(import.meta.url))
const BRUTO = join(DIR, 'bruto')
const PROGRESSO = join(DIR, 'progresso.json')
const FALHAS = join(DIR, 'falhas.json')
const FONTES: Record<string, FonteGeo> = { loga, ecourbis }

interface Item {
  ponto: number
  fonte: string
  lat: number
  lng: number
}
/** Uma linha de coleta/bruto/<nome>.pontos.jsonl: quantos trechos cada fonte devolveu em cada ponto. */
interface ResultadoPonto {
  ponto: number
  fonte: string
  lat: number
  lng: number
  raio: number
  n: number
}
interface Falha extends Item {
  area: string
  nome: string
  raio: number
  erro: string
  quando: string
}
interface Progresso {
  area: string
  nome: string
  raio: number
  fontes: string[]
  proximo: number
  total: number
  inicio: string
}

function args() {
  const a = Object.fromEntries(
    process.argv.slice(2).map((s) => {
      const [k, v] = s.replace(/^--/, '').split('=')
      return [k!, v ?? 'true']
    }),
  )
  const area = a.area ?? 'cidade'
  if (!AREAS[area]) throw new Error(`área desconhecida: ${area}. Opções: ${Object.keys(AREAS).join(', ')}`)
  const raio = Number(a.raio ?? 2000)
  const fontes = (a.fontes ?? 'loga,ecourbis').split(',')
  for (const f of fontes) if (!FONTES[f]) throw new Error(`fonte desconhecida: ${f}`)
  const nome = a.nome ?? area
  // --mascara=<nome>:<fonte>  só pontos a até <raio da varredura <nome>> de um ponto onde <fonte> respondeu algo
  const mascara = a.mascara ? { nome: a.mascara.split(':')[0]!, fonte: a.mascara.split(':')[1] ?? 'loga' } : undefined
  return { area, nome, raio, fontes, soFalhas: a.falhas === 'true', mascara }
}

const lerJson = <T>(p: string, padrao: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : padrao)

function fmtTempo(ms: number) {
  const s = Math.round(ms / 1000)
  return s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}s`
}

async function main() {
  const { area, nome, raio, fontes, soFalhas, mascara } = args()
  mkdirSync(BRUTO, { recursive: true })
  const saida = join(BRUTO, `${nome}.jsonl`)
  const saidaPontos = join(BRUTO, `${nome}.pontos.jsonl`)
  let pontos: Ponto[] = gerarGrade(AREAS[area]!, raio)
  if (mascara) {
    const arq = join(BRUTO, `${mascara.nome}.pontos.jsonl`)
    if (!existsSync(arq)) throw new Error(`máscara não encontrada: ${arq}`)
    const ativos = readFileSync(arq, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ResultadoPonto)
      .filter((r) => r.fonte === mascara.fonte && r.n > 0)
    const antes = pontos.length
    pontos = pontos.filter((p) => ativos.some((r) => distanciaM(p, r) <= r.raio))
    console.log(`Máscara ${mascara.nome}:${mascara.fonte}: ${ativos.length} pontos ativos; grade de ${antes} reduzida para ${pontos.length}.`)
  }
  const cliente = criaCliente({ log: (m) => console.log(`   ${m}`) })
  const aCada = Number(process.env.CHECKPOINT_A_CADA ?? 5)

  let itens: Item[]
  let prog: Progresso
  const falhasAntigas = lerJson<Falha[]>(FALHAS, [])

  if (soFalhas) {
    itens = falhasAntigas.filter((f) => f.nome === nome && f.raio === raio)
    if (itens.length === 0) return console.log('Nenhuma falha registrada para esta área/raio.')
    console.log(`Repetindo ${itens.length} itens que falharam.`)
    prog = { area, nome, raio, fontes, proximo: 0, total: itens.length, inicio: new Date().toISOString() }
  } else {
    itens = pontos.flatMap((p, ponto) => fontes.map((fonte) => ({ ponto, fonte, lat: p.lat, lng: p.lng })))
    const salvo = lerJson<Progresso | null>(PROGRESSO, null)
    if (salvo && salvo.area === area && salvo.nome === nome && salvo.raio === raio && salvo.fontes.join() === fontes.join()) {
      prog = salvo
      console.log(`Continuando de onde parou: item ${prog.proximo + 1} de ${prog.total}.`)
    } else {
      if (salvo) console.log(`Progresso de outra varredura (${salvo.area}, raio ${salvo.raio}) descartado.`)
      prog = { area, nome, raio, fontes, proximo: 0, total: itens.length, inicio: new Date().toISOString() }
      writeFileSync(saida, '')
      writeFileSync(saidaPontos, '')
    }
    console.log(`Área ${area}: ${pontos.length} pontos x ${fontes.length} fontes = ${itens.length} requisições, raio ${raio} m.`)
  }

  // Falhas desta rodada substituem as antigas da mesma área/raio que foram repetidas.
  const falhas: Falha[] = soFalhas ? falhasAntigas.filter((f) => !(f.nome === nome && f.raio === raio)) : falhasAntigas
  const t0 = Date.now()
  const inicial = prog.proximo
  let interrompido = false
  process.on('SIGINT', () => {
    interrompido = true
    console.log('\nInterrompendo depois do item atual...')
  })

  for (let i = prog.proximo; i < itens.length && !interrompido; i++) {
    const it = itens[i]!
    const p: Ponto = { lat: it.lat, lng: it.lng }
    const fonte = FONTES[it.fonte]!
    const url = fonte.url(p, raio)
    try {
      const trechos = fonte.parse(await cliente.getJson(url))
      if (trechos.length) appendFileSync(saida, trechos.map((t) => JSON.stringify(t)).join('\n') + '\n')
      const rp: ResultadoPonto = { ponto: it.ponto, fonte: it.fonte, lat: p.lat, lng: p.lng, raio, n: trechos.length }
      appendFileSync(saidaPontos, JSON.stringify(rp) + '\n')
      const feitos = i + 1 - inicial
      const resta = ((Date.now() - t0) / feitos) * (itens.length - i - 1)
      console.log(`[${i + 1}/${itens.length}] ${it.fonte} ponto ${it.ponto} (${p.lat}, ${p.lng}): ${trechos.length} trechos · faltam ~${fmtTempo(resta)}`)
    } catch (e) {
      const erro = (e as Error).message
      console.log(`[${i + 1}/${itens.length}] ${it.fonte} ponto ${it.ponto}: FALHOU (${erro})`)
      falhas.push({ ...it, area, nome, raio, erro, quando: new Date().toISOString() })
      writeFileSync(FALHAS, JSON.stringify(falhas, null, 2))
    }
    prog.proximo = i + 1
    if (!soFalhas && (prog.proximo % aCada === 0 || prog.proximo === itens.length)) {
      writeFileSync(PROGRESSO, JSON.stringify(prog, null, 2))
    }
  }

  if (soFalhas) writeFileSync(FALHAS, JSON.stringify(falhas, null, 2))
  if (interrompido) {
    if (!soFalhas) writeFileSync(PROGRESSO, JSON.stringify(prog, null, 2))
    console.log(`Parado em ${prog.proximo}/${itens.length}. Rode de novo para continuar.`)
    return
  }
  if (!soFalhas) rmSync(PROGRESSO, { force: true })
  const minhas = falhas.filter((f) => f.nome === nome && f.raio === raio).length
  console.log(`\nFim em ${fmtTempo(Date.now() - t0)}. Saída: ${saida}`)
  console.log(minhas ? `${minhas} falhas em coleta/falhas.json. Rode com --falhas para repetir.` : 'Sem falhas.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
