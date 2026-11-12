/**
 * Confere 3 CEPs conhecidos ao vivo contra site/dados. Serve para saber se as fontes mudaram
 * (formato, horários) desde a última varredura.
 *
 *   npm run checar-fontes
 *
 * Para cada CEP, consulta as fontes num raio pequeno ao redor de uma coordenada conhecida da rua,
 * pega os trechos com aquele CEP e compara empresa + dias da coleta comum e da seletiva com as
 * opções da base. Todo resultado ao vivo precisa existir na base (a base pode ter opções a mais,
 * de outros trechos do mesmo CEP). Saída 1 se algo divergir ou se uma fonte não responder.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ArquivoPrefixo } from './agrega.ts'
import { criaCliente } from './http.ts'
import { ecourbis } from './fontes/ecourbis.ts'
import { loga } from './fontes/loga.ts'
import type { Coleta, FonteGeo, Ponto } from './tipos.ts'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RAIO = 300

type Consulta = { fonte: FonteGeo; ponto: Ponto }
const CASOS: { cep: string; descricao: string; consultas: Consulta[] }[] = [
  {
    cep: '01308080',
    descricao: 'Loga (Rua Plínio Figueiredo, Bela Vista)',
    consultas: [{ fonte: loga, ponto: { lat: -23.561176, lng: -46.656281 } }],
  },
  {
    cep: '04753060',
    descricao: 'Ecourbis (Av. Padre José Maria, Santo Amaro)',
    consultas: [{ fonte: ecourbis, ponto: { lat: -23.653939, lng: -46.708544 } }],
  },
  {
    // Divisa: a Loga (setor PI01) atende o começo da rua; a Ecourbis, o resto.
    cep: '04514000',
    descricao: 'as duas empresas (Rua Graúna, Vila Nova Conceição)',
    consultas: [
      { fonte: loga, ponto: { lat: -23.599344, lng: -46.674002 } },
      { fonte: ecourbis, ponto: { lat: -23.600115, lng: -46.672877 } },
    ],
  },
]

const assin = (empresa: string, comum?: Pick<Coleta, 'dias'>, seletiva?: Pick<Coleta, 'dias'>) =>
  `${empresa} | comum ${comum?.dias.join(',') || '-'} | seletiva ${seletiva?.dias.join(',') || '-'}`

async function main() {
  const http = criaCliente()
  let problemas = 0
  for (const caso of CASOS) {
    console.log(`\n${caso.cep}: ${caso.descricao}`)
    const arq = JSON.parse(readFileSync(join(RAIZ, 'site/dados/cep', `${caso.cep.slice(0, 5)}.json`), 'utf8')) as ArquivoPrefixo
    const base = new Set(
      (arq.ceps[caso.cep] ?? []).map((o) => {
        const s = arq.setores[o.setor]!
        return assin(s.empresa, s.comum, s.seletiva)
      }),
    )
    for (const b of base) console.log(`   base:     ${b}`)
    if (!base.size) {
      console.log('   ✗ CEP ausente da base')
      problemas++
    }
    for (const { fonte, ponto } of caso.consultas) {
      let trechos
      try {
        trechos = fonte.parse(await http.getJson(fonte.url(ponto, RAIO)))
      } catch (e) {
        console.log(`   ✗ ${fonte.empresa} não respondeu: ${(e as Error).message}`)
        problemas++
        continue
      }
      const vivos = new Set(trechos.filter((t) => t.ceps.some((c) => c.cep === caso.cep)).map((t) => assin(t.empresa, t.comum, t.seletiva)))
      if (!vivos.size) {
        console.log(`   ✗ ${fonte.empresa}: nenhum trecho com esse CEP perto do ponto (${trechos.length} trechos no raio)`)
        problemas++
      }
      for (const v of vivos) {
        const ok = base.has(v)
        if (!ok) problemas++
        console.log(`   ${ok ? '✓' : '✗'} ao vivo: ${v}`)
      }
    }
  }
  console.log(problemas ? `\n${problemas} problema(s). Rode a varredura de novo ou investigue a fonte.` : '\nTudo confere.')
  process.exit(problemas ? 1 : 0)
}

main()
