// Teste rápido ao vivo: 1 requisição por fonte. Rodar com `npm run teste-vivo`.
import { criaCliente } from './http.ts'
import { loga } from './fontes/loga.ts'
import { ecourbis } from './fontes/ecourbis.ts'
const c = criaCliente({ log: console.log })
const a = loga.parse(await c.getJson(loga.url({ lat: -23.5614, lng: -46.6559 }, 300)))
const b = ecourbis.parse(await c.getJson(ecourbis.url({ lat: -23.6545, lng: -46.7095 }, 300)))
console.log('loga', a.length, JSON.stringify(a[0]))
console.log('eco', b.length, JSON.stringify(b[0]))
