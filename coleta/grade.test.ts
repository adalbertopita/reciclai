import { describe, expect, it } from 'vitest'
import { AREAS, distanciaM, gerarGrade } from './grade.ts'

describe('gerarGrade', () => {
  it('cobre toda a caixa: qualquer ponto fica a <= raio de algum centro', () => {
    const c = AREAS['amostra-ecourbis']!
    const raio = 2000
    const pts = gerarGrade(c, raio)
    for (let a = 0; a <= 20; a++) {
      for (let b = 0; b <= 20; b++) {
        const p = { lat: c.latMin + ((c.latMax - c.latMin) * a) / 20, lng: c.lngMin + ((c.lngMax - c.lngMin) * b) / 20 }
        const menor = Math.min(...pts.map((q) => distanciaM(p, q)))
        expect(menor).toBeLessThanOrEqual(raio)
      }
    }
  })

  it('cidade com raio de 2 km fica na casa de centenas de pontos', () => {
    const n = gerarGrade(AREAS.cidade!, 2000).length
    expect(n).toBeGreaterThan(300)
    expect(n).toBeLessThan(700)
  })

  it('caixa pequena vira 1 ponto no centro', () => {
    expect(gerarGrade({ latMin: 0, latMax: 0.001, lngMin: 0, lngMax: 0.001 }, 2000)).toEqual([{ lat: 0.0005, lng: 0.0005 }])
  })
})
