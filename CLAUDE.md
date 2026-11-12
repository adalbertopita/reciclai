# Reciclaí: consulta de coleta de lixo por CEP (São Paulo)

Produto: [docs/PRD.md](docs/PRD.md). Visual: [docs/DESIGN.md](docs/DESIGN.md). Pedido original e etapas: [docs/PROMPT.md](docs/PROMPT.md).

## Arquitetura (decidida)

Tudo estático. Sem backend, sem banco e sem consulta às concessionárias na hora do uso.

- `coleta/`: scripts Node + TypeScript que rodam **na máquina do autor**, varrem as fontes e geram JSON.
- `site/`: HTML + CSS + JS mínimo que lê `site/dados/*.json`. Hospedagem gratuita com link fixo para o QR Code.
  - ⚠️ **O servidor é estático, sem Node.** `site/` é HTML + CSS + JS puro (ES2017+, `<script defer>`), **sem etapa de build**, sem TypeScript, sem bundler e sem `node_modules`. O que estiver em `site/` é exatamente o que vai para o servidor. Node/TS existe só em `coleta/`.
- `fixtures/`: respostas reais salvas no reconhecimento, usadas pelos testes dos parsers.

## Status

- [x] 1. Reconhecimento (1a, 1b, 1c), registrado abaixo (11/11/2026)
- [x] 2. Adaptadores com testes de fixture (11/11/2026): `coleta/fontes/{loga,ecourbis,reciclasampa}.ts`, 36 testes
- [x] 3. Varredura de amostra (Bela Vista/Loga, Santo Amaro/Ecourbis) e conferência manual (11/11/2026). Ver "Amostra" abaixo. **Decisões pendentes antes da etapa 4.**
- [x] 4. Varredura completa + validação (12/11/2026). Ver "Resultado da varredura" abaixo
- [x] 5. Site (12/11/2026): `site/index.html`, `site/dicas.html`, `site/css/estilo.css`, `site/js/app.js`. Ver "Site" abaixo
- [ ] 6. Teste de ponta a ponta no celular
- [ ] 7. Publicação + link do QR Code

---

## Reconhecimento (11/11/2026)

### 1a. Dados prontos em bloco: **não existem**

| Onde procurei | Resultado |
|---|---|
| Sites da Loga e da Ecourbis | Nenhum KML, GeoJSON, shapefile ou PDF de setores. Os dois só oferecem consulta por ponto no mapa. |
| GeoSampa e dados abertos da PMSP | Nenhuma camada ou dataset de setores ou horários de coleta. A PMSP publica só tonelagem anual ("coleta de lixo segundo origem"). |
| `coleta.prefeitura.sp.gov.br` (portal da PMSP, Liferay) | **Não tem dado próprio.** Geocodifica o CEP no Google, chama as **mesmas duas APIs** abaixo (Loga e Ecourbis) e mostra a que responder. Confirma que essas APIs são a fonte oficial. |
| Payload embutido no front | Nenhum. Os dois fronts buscam via fetch/XHR a cada consulta. |

**Achado que substitui o "dado em bloco":** as duas APIs aceitam **raio grande** (testado até 5 km, sem teto) e devolvem todos os logradouros/trechos do círculo **com CEP e horários**. Uma varredura por **grade de coordenadas** cobre a cidade com poucas centenas de requisições.

### 1b. Como cada fonte responde

#### Loga (Centro, Norte, Oeste, parte da Leste)

- Página pública: `https://www.loga.com.br/pesquisa-de-coleta/` (WordPress). Embute o iframe `https://sgo3.loga.com.br/consultav2/`. O JS está em `consultav2/assets/js/index.js` (fixture `fixtures/loga/consultav2-index.js`).
- O front geocodifica o endereço no Google e chama a API com a coordenada.

```
GET https://webservices.loga.com.br/sgo/eresiduos/BuscaPorLatLng
    ?distance=<metros>&lat=<lat>&lng=<lng>&distanceEBVidro=<metros>
```

- **Headers obrigatórios: nenhum.** `curl` puro responde 200. Não precisa de Referer, Origin, cookie nem token. CORS aberto (reflete o Origin). Servidor: IIS.
- `distance`: o front usa 100. Testado com 500 (31 logradouros, 1 s), 2000 (390 logradouros, 515 KB, 1,6 s) e 5000 (2.328 logradouros, 2,6 MB, 4,7 s).
- `distanceEBVidro=0` desliga o bloco de Ecobox de vidro, que não nos interessa.
- Fora da área da Loga, responde `{"naoAtendido":true}` (fixture `loga/busca-latlng-nao-atendido.json`).
- Resposta (`fixtures/loga/busca-latlng-paulista-d100.json`):
  ```jsonc
  { "found": true, "result": {
      "PEVs": [...], "EcoBoxVidros": [...], "Conteiners": [...],
      "Logradouros": [{
        "Tipo": "R", "Titulo": "PROF", "Preposicao": "", "Logradouro": "OTAVIO MENDES",
        "Subprefeitura": "SÉ", "Cep": "01332040",            // CEP completo, 8 dígitos
        "Domiciliar": { "Periodo": "NOTURNO", "Setor": "SE09", "Lat": -23.56, "Lng": -46.65,
                        "HorarioPlanejado": "22:02",
                        "HoraSeg": "22:02", ..., "HoraDom": "",
                        "HasSeg": true, ..., "HasDom": false,
                        "ConsultaMunicipeHideHorario": false, "ConsultaMunicipeSetorEmRevisao": false },
        "Seletiva":   { mesmo formato, ou null },
        "Mecanizada": null | {...} }]}}
  ```
- **Unidade do dado:** linha = logradouro + CEP + setor. O setor tem código (`SE09`, `PI04`...), que serve como id reaproveitável. Há setores diferentes para domiciliar e seletiva.
- ⚠️ `Domiciliar` pode vir `null` (209 de 2.328 na amostra de 5 km): rua só com seletiva ou com coleta mecanizada (contêiner, `Mecanizada` != null).
- ⚠️ `ConsultaMunicipeHideHorario` / `ConsultaMunicipeSetorEmRevisao`: quando `true`, o site da Loga esconde o horário. Respeitar: mostrar só os dias e o turno.
- ⚠️ Os horários variam por dia (`HoraSeg` 22:00, `HoraTer` 20:31...). Para o morador, usar o **mais cedo** da semana como "a partir das" ou mostrar por dia. Decidir no site.

#### Ecourbis (Sul e Leste)

- Página pública: `https://www.ecourbis.com.br/coleta/index.html`, uma SPA com o bundle `localizador.<hash>.js`. O hash muda, então ler o nome do script a partir do HTML.
- A config embutida no bundle traz `api.url = https://apicoleta.ecourbis.com.br` (`api.dev = https://api-ecourbis.clouddog.com.br`). O front usa o ViaCEP e o Google para obter a coordenada.

```
GET https://apicoleta.ecourbis.com.br/coleta?lat=<lat>&lng=<lng>&dst=<metros>&limit=<n>
```

- **Headers obrigatórios: nenhum.** CORS aberto. Servidor: nginx.
- ⚠️ `limit` padrão = **5**. Sempre mandar `limit` alto (ex.: 100000). Testado: dst=2000 trouxe 560 trechos (488 KB); dst=5000 trouxe 3.287 trechos (2,9 MB, 2,1 s).
- Fora da área: `{"query":{...},"result":[]}`.
- Resposta (`fixtures/ecourbis/coleta-santo-amaro-d100.json`):
  ```jsonc
  { "query": {...}, "result": [{
      "id": "24219088", "distancia": 36.3, "respostaAceitavel": false, "popup": null,
      "endereco": { "logradouro": "Rua Humboldt", "subprefeitura": "SANTO AMARO", "distrito": "SANTO AMARO",
                    "cep_direita": "04753-70", "cep_esquerda": "04753-70" },
      "domiciliar": { "frequencia": "SEG/QUA/SEX", "periodo": "NOTURNO", "mensagem": "...",
                      "horarios": { "seg": "NOTURNO", "ter": "-", "qua": "NOTURNO", ... } },
      "seletiva":   { "frequencia": "QUINTA", "periodo": "DIURNO", "horarios": { "qui": "07:30", ... } } }]}
  ```
- **Unidade do dado:** **trecho de rua** (`id`), com CEP do lado direito e do lado esquerdo. Não traz código de setor nem coordenada do trecho.
- ⚠️ **CEP vem corrompido**: o sufixo perde os zeros à esquerda. `04753-70` é 04753-**0**70, `04733-` é 04733-**000**, `04745-1` é 04745-**001**. Correção: `prefixo + sufixo.padStart(3,'0')`. Há ainda casos estranhos (`0475-210`, `00000-`). O adaptador precisa de teste com esses casos, e o CEP corrigido precisa ser conferido contra a base do IBGE. Amostra: 169 de 190 CEPs corrigidos existem no IBGE.
- ⚠️ `cep_direita != cep_esquerda` em cerca de 6% dos trechos: os lados da rua (par/ímpar) têm CEPs diferentes.
- ⚠️ `horarios.<dia>` pode ser hora (`"07:30"`), só o turno (`"NOTURNO"`/`"DIURNO"`) ou `"-"` (sem coleta). Sem domingo.
- ⚠️ `frequencia` vem como texto: `SEG/QUA/SEX`, `TER/QUI/SAB`, `DIARIO`, `QUINTA`, `SABADO`...

#### Recicla Sampa (bairro → empresa)

- `GET https://www.reciclasampa.com.br/horarios-de-coleta`: HTML server-rendered, sem header especial.
- Tabela `#horarios-coleta`. Cada `<tr>` traz um `<a href=…>NOME</a>` e um `<td class="d-none">slug</td>`. **A empresa vem do href** (`loga.com.br` ou `ecourbis.com.br`).
- 217 linhas, das quais 1 é lixo (link para um artigo) e 2 são repetições exatas (SAPOPEMBA e SOCORRO, Ecourbis duas vezes). Resultado: **214 pares bairro+empresa** (118 Loga, 96 Ecourbis).
- Bairros com as duas empresas: só **ARTUR ALVIM, BROOKLIN PAULISTA, VILA NOVA CONCEIÇÃO**, como diz o PRD. Coberto por teste.
- Parse de exemplo: `fixtures/reciclasampa/bairros-parseado.json`.

#### Base de CEPs de referência: IBGE CNEFE 2022 (aberta e gratuita)

- `https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Agregados_por_CEP/Agregados_por_CEP_CNEFE_Censo_2022.zip` (9 MB zip, CSV `;`, colunas `CEP;TOT_END;TOT_DP;...`).
- Capital (prefixos 01000–05999 e 08000–08499): **46.901 CEPs**, 5,65 milhões de endereços, 3.172 prefixos de 5 dígitos.
- Uso: medir a cobertura da varredura (quantos CEPs com domicílio ficaram sem horário) e corrigir os CEPs da Ecourbis. **Não é a lista que dirige a varredura.**
- Existe também o CNEFE por endereço, com coordenada e número (`Arquivos_CNEFE/CSV/Municipio/`). Fica como plano B para resolver CEP com mais de um horário pelo número da casa.

### 1c. Unidade da varredura: **grade de coordenadas**

- A lista de CEPs vem **das próprias APIs**. Não depende da base DNE (paga) nem de uma lista externa.
- Grade sobre a bbox da capital (lat −24,01 a −23,36; lng −46,83 a −46,36). Raio de 2.000 m e espaçamento de 2.800 m (≤ r·√2, o que garante cobertura sem buraco).
  - Bbox: ~490 pontos. Dentro do município: ~200 a 250 (área de 1.521 km² dividida por 7,84 km²).
  - **Cada ponto consulta as duas APIs**. Total de ~500 requisições.
  - Ritmo de 1 a 2 s + ~1,5 s de resposta: **~25 a 35 min** a varredura completa. Transferência estimada de ~250 a 400 MB.
  - Pontos que vierem vazios nas duas APIs e ficarem fora do polígono do município podem ser descartados.
- Deduplicar por chave estável: Loga por `Cep|Logradouro|Domiciliar.Setor|Seletiva.Setor`, Ecourbis por `id`.
- CEP com mais de um horário: ~6% (Loga) e ~10% (Ecourbis) na amostra. Muitos são praça × rua com o mesmo CEP genérico ou lados da rua. Plano: guardar as alternativas com o nome do logradouro e o lado (Ecourbis), e no site perguntar "qual destas é a sua rua?" ou o lado. Avaliar o CNEFE (número → coordenada) só se isso não bastar.

### Armadilhas gerais ⚠️

- ⚠️ Não usar browser na varredura: as duas APIs funcionam com fetch puro.
- ⚠️ Ecourbis `limit` padrão 5: sem ele, a varredura perde quase tudo.
- ⚠️ Ecourbis CEP sem zeros à esquerda no sufixo (ver acima).
- ⚠️ Raio de 5 km funciona, mas a resposta de 2,6 MB e 4,7 s na Loga aumenta o risco de timeout. Preferir 2 km.
- ⚠️ zsh: não começar argumento de `echo` com `=` (ex.: `echo ====`), porque o zsh tenta expandir e dá "not found".
- ⚠️ **TLS da Ecourbis no Node:** `apicoleta.ecourbis.com.br` manda só o certificado final, sem o intermediário "GlobalSign GCC R6 AlphaSSL CA 2025". Browser e curl do macOS completam a cadeia sozinhos (AIA), mas o `fetch` do Node falha com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
  - Solução: o intermediário fica em `coleta/certs/globalsign-alphassl-ca-2025.pem` (baixado de `http://secure.globalsign.com/cacert/gsgccr6alphasslca2025.crt`, validado com `openssl verify` contra a raiz GlobalSign R6). Os scripts npm passam `NODE_EXTRA_CA_CERTS` apontando para ele.
  - **Nunca** usar `NODE_TLS_REJECT_UNAUTHORIZED=0`.
  - O intermediário vence em **21/05/2027**. Se a Ecourbis trocar de certificado, repetir: `openssl s_client ... | openssl x509 -noout -text | grep 'CA Issuers'` e baixar o novo.
- ⚠️ `tsx -e` não aceita top-level await (compila em CJS). Escreva um arquivo `.ts` e rode com `tsx arquivo.ts`.

## Amostra (etapa 3, 11/11/2026): descobertas que mudam o plano

### ⚠️ Loga: 1 registro por rua por consulta (o trecho mais próximo)
- `BuscaPorLatLng` devolve **cada logradouro uma vez só**, com CEP e setor do **trecho mais próximo do ponto**. Não importa o raio.
- Exemplo, Av. Paulista em 3 pontos: `01310000/SE33`, `01311200/SE33`, `01310300/SE12`. Com `distance=300` ou `2000`, o registro da Paulista é o mesmo.
- Consequência: para a Loga, **raio grande não adianta, precisa de densidade de pontos**.
  - Em Bela Vista, contra a verdade de referência (CNEFE): espaçamento de 580 m (`--raio=420`) achou 141/186 CEPs; de 390 m (`--raio=280`), 154/186; de 190 m (`--raio=140`), 162/186 (87%).
- A Loga também ignora o lado da rua: Alameda Franca tem `01422000` (par) e `01422001` (ímpar), e a Loga só devolve um deles.
- A `distance` da Loga é fiel: com 1000 m, o ponto mais distante devolvido estava a 993 m reais.

### ⚠️ Ecourbis: a "distância" da API é ~1,75x a real
- Medido nas 4 direções a partir de um trecho: razões entre 1,65 e 1,81. Com `dst=1000`, a cobertura real é de ~550 m, e a Rua Humboldt ficou de fora na primeira amostra.
- Correção: o adaptador manda `dst = raio x 1,9` (`FATOR_DST`).
- Depois disso: 156/163 CEPs (95%) contra o CNEFE.

### ⚠️ CEP da capital
- A Ecourbis tem erro de digitação: `00475-210` num lado do trecho, `04753-210` no outro. `cepValido` agora só aceita as faixas da capital (01000–05999, 08000–08499).

### ⚠️ CNEFE (IBGE) também erra CEP
- Exemplo: Av. Nove de Julho, 1123 aparece como `01407200`, mas pelo ViaCEP esse CEP é "de 4701 ao fim, lado ímpar". Há também CEPs de outras zonas geocodificados no lugar errado.
- Usar o CNEFE como **referência aproximada**, nunca como verdade absoluta.
- Arquivo: `coleta/bruto/ibge/3550308_SAO_PAULO.csv` (945 MB, fora do git).
  - Colunas úteis: 9 = CEP, 11–13 = tipo/título/nome da via, 14 = número, 26/27 = lat/lng, 29 = espécie (1 = domicílio particular).
  - Baixado de `.../Censo_Demografico_2022/Arquivos_CNEFE/CSV/Municipio/35_SP/3550308_SAO_PAULO.zip` (186 MB).

### CEP com mais de uma opção (18% na amostra)
- 27 casos são **ruas diferentes com o mesmo CEP** (praça × rua): o site pergunta "qual é a sua rua?".
- 72 casos (13%) são a **mesma rua com horários diferentes por trecho**: a fronteira do setor corta o CEP. Exemplos: Rua Itapeva com seletiva na terça num trecho e na segunda em outro; Av. Padre José Maria com coleta comum diária num trecho e seg/qua/sex em outro.
- Sem o número da casa não dá para separar esses casos (ver Plano B).

### Conferência manual com coleta.prefeitura.sp.gov.br
| CEP | Portal | Nossa base |
|---|---|---|
| 01308080 | Loga, comum seg–sáb noturno, seletiva ter 12:49 | igual |
| 04745001 | Ecourbis, comum seg–sáb 00:20–01:35, seletiva sáb 08:25 | dias iguais; horário "a partir das 20h30" (⚠️ outro trecho do mesmo CEP passa às ~20h30) |
| 01332000 | Loga, seletiva ter 09:30 | 2 opções: ter 9h30 **ou** seg 12h |
| 04753060 | Ecourbis, comum diária, seletiva qui 07:30 | 2 opções: diária **ou** seg/qua/sex |

O portal mostra só o trecho mais perto do ponto geocodificado do CEP. A nossa base é mais completa, porque mostra as alternativas.

## Decisões (11/11/2026, após a amostra)

1. **Varredura em 2 fases.**
   - Fase 1: grade grossa com raio de 2 km nas duas empresas. Cobre toda a Ecourbis e mapeia onde a Loga atende.
   - Fase 2: Loga densa com `--raio=280` (pontos a cada ~390 m), só perto de onde a Loga respondeu na fase 1 (`--mascara=cidade-grossa:loga`).
   - **CEP que não aparecer em nenhuma das duas fases cai no fallback do site**: "quem atende é a [empresa]" (pelo bairro do ViaCEP + `bairros.json`) e o link oficial.
2. **CEP da mesma rua com horários diferentes por trecho:** o site mostra **as duas opções**, com aviso honesto ("depende do trecho da rua") e o link oficial. Plano B (número da casa via CNEFE) adiado.
3. **Texto do horário:**
   - Se a diferença entre a primeira e a última hora (todas as horas de todos os dias e trechos juntados no CEP) for **≤ 1h30**: "a partir das X", com X arredondado para baixo à meia hora.
   - Se for maior: **"entre X e Y"**, com X para baixo e Y para cima à meia hora. Exemplo: 20:31–22:40 vira "entre 20h30 e 23h".
   - Implementado em `textoHorario` (`normaliza.ts`). Em `agrega.ts`, o texto é calculado com todas as horas do grupo.

## Rodar a varredura da cidade (passo a passo)

```bash
# tudo de uma vez, sem deixar o Mac dormir (log em coleta/bruto/varredura-cidade.log)
caffeinate -i -s -m sh -c 'npm run -s varredura -- --area=cidade --raio=2000 --nome=cidade-grossa \
  && npm run -s varredura -- --area=cidade --fontes=loga --raio=280 --nome=cidade-loga-densa --mascara=cidade-grossa:loga \
  && npm run -s gerar-dados -- --area=cidade-grossa,cidade-loga-densa' > coleta/bruto/varredura-cidade.log 2>&1
```

- Se parar no meio (queda de rede, Ctrl+C, reinício), **rode o mesmo comando de novo**: cada fase continua de onde parou, pelo `coleta/progresso.json`. Uma fase já terminada recomeça do zero se rodar de novo, então pule-a.
- Falhas: `npm run varredura -- --area=cidade --raio=2000 --nome=cidade-grossa --falhas` (ou com os parâmetros da fase 2).
- `caffeinate` impede o repouso por inatividade, mas **não** o de fechar a tampa do notebook.
- Tempo da 1ª execução (11–12/11/2026): fase 1 ≈ 40 min (918 req.). Fase 2: a máscara reduziu a grade de 22.936 para 4.053 pontos, ≈ 1h45.
- ⚠️ O projeto fica num disco externo (`/Volumes/MORBO`). Na 1ª execução o disco sumiu por um instante e o processo morreu ao escrever o log. Por isso o comando usa `caffeinate -m` (impede o repouso do disco). Se acontecer, rode a fase que parou de novo: ela continua do checkpoint.

## Resultado da varredura (etapa 4, 12/11/2026)

- 120.825 trechos (Loga 26.062, Ecourbis 94.763), sem falhas. **44.637 CEPs** em 3.168 arquivos (`site/dados/`, 15 MB; média 2,9 KB, maior 25 KB).
- 6.107 CEPs (14%) com mais de uma opção; 289 CEPs com as duas empresas (divisas).
- `npm run validar`:
  - Integridade: 0 erros.
  - Contra o CNEFE: **90,2% dos CEPs com domicílio** (41.384 de 45.886) e **93,3% dos domicílios** têm horário.
  - Empresa contra o Recicla Sampa (bairro do CEP pelo CNEFE): **99,3% iguais**. As divergências são bairros com nome repetido em zonas diferentes (Barro Branco, Jardim São Paulo) ou divisas.
- `npm run checar-fontes`: os 3 CEPs batem ao vivo.

### Por que faltam CEPs (amostra conferida nas APIs)
- **CEP diferente para a mesma rua:** o CNEFE tem `05414001` e a Loga tem `05414012` para a Rua Cônego Eugênio Leite; o CNEFE tem `08381173` e a Ecourbis tem `08381170`. São lados ou faixas de número da mesma rua.
- **Ecourbis sem CEP:** trechos com `00000-` (ex.: Rua Valdete, Iguatemi). Não dá para ligar ao CEP.
- **CEP errado no CNEFE:** `01001000` (Praça da Sé) com 6.350 domicílios em "Jardim Paulistano" e `08260295` em "Bom Retiro" são erros do CNEFE.
- **Ideia para o site:** quando o CEP não estiver na base, buscar a rua do ViaCEP entre as ruas do mesmo prefixo. Isso exige um índice rua→setor no arquivo do prefixo. Ainda não foi feito.

### Para o site
- ⚠️ Quando as opções de um CEP forem de **empresas diferentes** (ex.: `04514000`, Rua Graúna: Loga no começo, Ecourbis no resto), os nomes das ruas são quase iguais ("Rua Grauna" × "Rua Graúna"). O rótulo da opção precisa mostrar a empresa e "depende do trecho", não só a rua.

## Site (etapa 5, 12/11/2026)

- JS puro (ES2017, `<script defer>`), sem build. Uma página (`index.html`) troca de tela em JS, e `dicas.html` é estática. Ícones Lucide num sprite SVG inline (`<use href="#i-...">`).
- **Fluxo** (`app.js`, `consultar`):
  1. Valida 8 dígitos (no envio).
  2. Fora das faixas da capital: tela "fora de SP", com a cidade pelo ViaCEP.
  3. Busca `dados/cep/<prefixo>.json`, o ViaCEP e `meta.json` em paralelo, com teto de 8 s.
  4. CEP na base: resultado. ViaCEP diz que o CEP não existe: erro na home.
  5. Sem dado: empresa pelo bairro do ViaCEP (`bairros.json`), ou pela maioria do prefixo, ou as duas. Mostra os 3 passos (copiar CEP, abrir site, colar).
  6. Passou de 8 s ou sem rede: a mesma tela, com "não conseguimos trazer o horário agora".
- **CEP com mais de uma opção:**
  - Ruas diferentes: "Qual é a sua rua?".
  - Mesma rua: "Depende do trecho da rua" + "trecho 1/2". A comparação ignora acento ("Rua Grauna" = "Rua Graúna").
  - Empresas diferentes: cada opção diz "coleta feita pela X", e aparecem os dois links.
- **Desvio do DESIGN.md:**
  - Tela 6.3 (número da casa): não temos faixa de número, então virou a tela de opções acima (decisão 2).
  - Card do Ecoponto mais perto: não temos coordenadas, então virou o botão "ver Ecopontos no mapa" (Google Maps, **sem** o CEP na URL).
- URL com `?cep=` (pushState + popstate). O CEP só vai para o ViaCEP. Sem cookie, localStorage nem analytics.
- Peso da 1ª visita (gzip): HTML 2 KB + CSS 3 KB + JS 6,5 KB + logo 20 KB + cidade 63 KB ≈ **95 KB**, sem a fonte. Cada consulta baixa ~0,5 KB.
- Testado no browser (375, 320 e 1280 px):
  - todas as telas;
  - máscara e envio pelo teclado;
  - voltar do navegador;
  - foco no h1;
  - sem rolagem horizontal em 320 px;
  - alvos de toque ≥ 44 px.
- ⚠️ **Servir localmente:** o preview do app desktop não lê o disco externo (permissão do macOS). Suba o servidor pelo terminal (`cd site && python3 -m http.server 8080`). O `.claude/launch.json` só aponta para `http://localhost:8080`.

## Código da coleta (etapa 2)

- `coleta/tipos.ts`: `Trecho`, `Coleta`, `FonteGeo` (interface comum: `url(ponto, raio)` + `parse(json)`), `BairroEmpresa`.
- `coleta/normaliza.ts`: chave de texto sem acento, turno e texto do horário.
  - **Regra do horário:** "a partir das" usa a hora mais cedo da semana, **arredondada para baixo à meia hora** (22:00/20:31/22:40 vira "a partir das 20h30").
  - No turno noturno, horas antes das 12h contam como madrugada (23:50 vem antes de 00:35).
  - Sem hora publicada (Ecourbis `"NOTURNO"`, ou Loga com `HideHorario`): só dias + turno, sem `horario`.
- `coleta/http.ts`: cliente educado.
  - Pausa aleatória entre `PAUSA_MIN_MS` e `PAUSA_MAX_MS` (padrão 1000–2000).
  - Fila com uma requisição por vez.
  - 429/503 esperam 30 s, 60 s, 90 s...
  - Erro comum (rede, 5xx) tenta mais 2 vezes. 4xx não repete.
- `coleta/fontes/loga.ts`:
  - `id = L|cep|logradouro|setorComum|setorSeletiva|M`.
  - Tipo de via expandido (`R` vira Rua, `AV` vira Avenida...).
  - `Mecanizada` vira `conteiner: true`.
- `coleta/fontes/ecourbis.ts`:
  - `id = E|<id>`.
  - `corrigeCepEcourbis` resolve o CEP corrompido.
  - Lados com CEPs diferentes viram `ceps: [{cep, lado:'direita'}, {cep, lado:'esquerda'}]`.
- `coleta/fontes/reciclasampa.ts`: `parseReciclaSampa(html)`. Lança erro se a tabela sumir.

## Comandos

```bash
npm install          # uma vez
npm test             # testes de parser com as fixtures reais
npm run typecheck
npm run teste-vivo   # 1 requisição real por fonte (Loga e Ecourbis)
npm run validar      # integridade + cobertura (CNEFE) + empresa (Recicla Sampa); relatório em coleta/bruto/validacao.json
npm run checar-fontes  # 3 CEPs conhecidos ao vivo contra site/dados (rodar antes de publicar dados novos)

# amostra (etapa 3)
npm run varredura -- --area=amostra-loga --fontes=loga --raio=140 --nome=teste-loga-r140
npm run varredura -- --area=amostra-ecourbis --raio=1000
npm run gerar-dados -- --area=teste-loga-r140,amostra-ecourbis --saida=coleta/amostra
```

- `coleta/grade.ts`: grade de círculos que cobre a caixa (lado ≤ raio·√2) e as áreas `cidade`, `amostra-loga` e `amostra-ecourbis`.
- `coleta/varredura.ts`: varre (`--area`, `--raio`, `--fontes`, `--nome`, `--falhas`). Checkpoint em `coleta/progresso.json`, falhas em `coleta/falhas.json`, saída em `coleta/bruto/<nome>.jsonl`. Ctrl+C para no próximo item e grava o progresso.
- `coleta/agrega.ts`: deduplica, agrupa por CEP e junta trechos com os mesmos dias e turno (fica a hora mais cedo de cada dia).
- `coleta/gerar-dados.ts`: escreve `cep/<prefixo>.json`, `bairros.json` e `meta.json`.
  - ⚠️ **Desvio do formato pedido:** não existe `setores.json` global. Os perfis de horário vão **dentro** de cada `cep/<prefixo>.json` (`{setores, ceps}`). Motivo: os horários variam rua a rua, o que dá milhares de perfis. Um arquivo global teria centenas de KB, e assim o celular baixa 1 arquivo de ~1 KB.
