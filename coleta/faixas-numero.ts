/**
 * Faixas de número da casa para CEPs atendidos pelas duas empresas (Loga num trecho, Ecourbis no outro).
 *
 * Os números vêm do CNEFE (IBGE), com a coordenada de cada endereço. Para saber a empresa de um número,
 * consulta-se a Loga naquela coordenada: `naoAtendido` = fora da área da Loga = Ecourbis.
 * Para não consultar número por número, os números de cada lado da rua (par/ímpar) são ordenados e o ponto
 * de troca é achado por busca binária. Supõe-se uma troca só por lado; quando as pontas dão a mesma empresa,
 * o meio e os quartis são conferidos para pegar uma ilha no meio.
 */
import type { Empresa } from './tipos.ts'

/** [primeiro número, último número, empresa]: números do CNEFE, inclusivos. */
export type Faixa = [number, number, Empresa]

export interface FaixasCep {
  /** Lado par. */
  p: Faixa[]
  /** Lado ímpar. */
  i: Faixa[]
}

/** Até este tamanho, classifica todos os números do lado (sai mais barato do que bissecar). */
export const CLASSIFICA_TODOS_ATE = 6
/** Níveis de conferência quando as pontas dão a mesma empresa: 2 = meio + quartis. */
const CONFERENCIA = 2

/**
 * @param numeros números distintos de um lado da rua, em ordem crescente
 * @param classifica empresa que atende o número (uma consulta à API)
 */
export async function faixasDoLado(
  numeros: number[],
  classifica: (n: number) => Promise<Empresa>,
): Promise<Faixa[]> {
  if (numeros.length === 0) return []
  const emp: (Empresa | undefined)[] = new Array(numeros.length)
  const c = async (i: number): Promise<Empresa> => (emp[i] ??= await classifica(numeros[i]!))

  if (numeros.length <= CLASSIFICA_TODOS_ATE) {
    for (let i = 0; i < numeros.length; i++) await c(i)
  } else {
    const divide = async (lo: number, hi: number, conferencia: number): Promise<void> => {
      if (hi - lo <= 1) return
      const meio = (lo + hi) >> 1
      if ((await c(lo)) !== (await c(hi))) {
        await c(meio)
        await divide(lo, meio, 0)
        await divide(meio, hi, 0)
      } else if (conferencia > 0) {
        if ((await c(meio)) !== emp[lo]) {
          await divide(lo, meio, 0)
          await divide(meio, hi, 0)
        } else {
          await divide(lo, meio, conferencia - 1)
          await divide(meio, hi, conferencia - 1)
        }
      }
    }
    await divide(0, numeros.length - 1, CONFERENCIA)
  }

  // Quem ficou sem consulta está entre dois vizinhos já classificados com a mesma empresa.
  let ultima = emp[0]!
  for (let i = 0; i < numeros.length; i++) {
    if (emp[i] === undefined) emp[i] = ultima
    ultima = emp[i]!
  }
  const faixas: Faixa[] = []
  for (let i = 0; i < numeros.length; i++) {
    const f = faixas[faixas.length - 1]
    if (f && f[2] === emp[i]) f[1] = numeros[i]!
    else faixas.push([numeros[i]!, numeros[i]!, emp[i]!])
  }
  return faixas
}

/**
 * Empresa de um número da casa (a mesma regra do site, em site/js/app.js).
 * Só responde dentro do intervalo que o CNEFE cobre: antes da primeira faixa, depois da última ou no vão
 * entre faixas de empresas diferentes, devolve null (o site mostra as duas opções).
 * Ex.: Rua Graúna (04514000) tem no CNEFE só os pares 68 a 208, todos Ecourbis, mas a Loga atende o começo da rua.
 */
export function empresaDoNumero(f: FaixasCep, n: number): Empresa | null {
  const lado = n % 2 === 0 ? f.p : f.i
  for (let k = 0; k < lado.length; k++) {
    const [ini, fim, e] = lado[k]!
    if (n < ini) return null
    if (n <= fim) return e
    const prox = lado[k + 1]
    if (prox && n < prox[0]) return prox[2] === e ? e : null
  }
  return null
}
