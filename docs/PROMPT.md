Vamos construir o projeto descrito em docs/PRD.md: uma página onde o morador de São Paulo digita o CEP e vê os dias e horários da coleta comum e seletiva, sem precisar saber se quem atende é a Loga ou a Ecourbis.

Comece pela coleta das informacoes no site

Decisões de design: estão no arquivo docs/DESIGN.md

Decisão de arquitetura: tudo estático
Sem backend, sem banco de dados, sem consulta aos sites das concessionárias no momento do uso. O projeto tem duas partes independentes:

Coleta (offline, na minha máquina): scripts Node + TypeScript que fazem a varredura completa dos dados uma única vez (e de novo quando for preciso atualizar) e geram arquivos JSON versionados no repositório.
Site (estático): HTML + CSS + JS mínimo que lê esses JSONs. Hospedado de graça (GitHub Pages, Netlify ou Cloudflare Pages) com link público estável para o QR Code.
Horário de coleta muda pouco, mas muda (nova concessão, reorganização de setores). Por isso o site mostra a data da última atualização e sempre o link oficial para conferência, e o script de varredura fica no repositório pronto para rodar de novo.

1. Fase de reconhecimento (antes de escrever código de produção)
O objetivo é descobrir a forma mais barata e confiável de obter o dado inteiro, não de consultar um CEP.

1a. Procure primeiro dados prontos
Antes de pensar em varredura, investigue se o dado já existe em bloco:

mapas ou arquivos dos setores de coleta (KML, GeoJSON, shapefile, PDF de tabela) nos sites da Loga e da Ecourbis;
camadas de coleta no GeoSampa e no portal de dados abertos da Prefeitura de São Paulo;
listas por setor/logradouro que o próprio front das concessionárias carregue inteiras (JSON estático em CDN/S3, payload embutido na página).
Se algo assim existir, a "varredura" vira um download + conversão. Me mostre o que encontrou antes de seguir.

1b. Mapeie como cada site responde a uma consulta
Para cada fonte (Loga, Ecourbis, Recicla Sampa), nesta ordem de preferência:

API que o próprio site consome. Faça uma consulta real no browser (Playwright ou o browser do Claude) com um CEP/endereço conhecido e capture o tráfego de rede (XHR/fetch): URL, método, body (JSON? form-urlencoded? multipart?), headers, formato da resposta.
Se não aparecer no tráfego: procure no bundle JS (grep por /api, fetch(, axios, ajax, .php, wp-json, admin-ajax), em payloads embutidos no HTML (__NEXT_DATA__, __NUXT_DATA__, chunks RSC self.__next_f.push, JSON-LD application/ld+json) e em JSONs estáticos.
HTML server-rendered: se o resultado vem no HTML de uma URL previsível, fetch + parse, sem browser.
Só por último, Playwright (com playwright-extra + puppeteer-extra-plugin-stealth), quando o dado só existe depois de JS rodar. Como a varredura roda na minha máquina, isso é aceitável, só mais lento.
Para cada endpoint, teste com curl/fetch puro, fora do browser, e descubra o mínimo para funcionar:

Headers obrigatórios: teste removendo um por vez. Casos comuns: Referer/Origin obrigatórios (403/301 sem eles), X-Requested-With, X-CSRF-TOKEN + cookie de sessão da mesma resposta (Laravel responde 419), tokens públicos fixos no bundle.
Formato do body: às vezes o Content-Type diz form-urlencoded mas o servidor só entende JSON (ou o contrário). Teste os dois.
Tokens que mudam: nunca hardcoded. Ler a cada execução da página que os expõe (meta tag, payload SSR).
Qual é a unidade do dado: o horário é por setor? por logradouro? por faixa de numeração? O mesmo CEP pode ter horários diferentes em lados opostos da rua? A resposta traz um id de setor reaproveitável?
1c. Defina a unidade da varredura
Com base no 1b, proponha o que vai ser varrido e de onde vem a lista:

por setor (se houver lista de setores), por logradouro ou por CEP;
se for por CEP: de onde vem a lista de CEPs da capital (a base DNE dos Correios é paga; avalie bases abertas e compare a cobertura);
estimativa de quantas requisições serão necessárias e quanto tempo levarão no ritmo educado (item 2).
Registre tudo num CLAUDE.md do projeto: URL, método, headers obrigatórios, exemplo de request/response, campos usados, avisos ⚠️ sobre armadilhas ("sem Referer responde 403", "não usar waitUntil: 'networkidle'" etc.). Salve respostas reais em fixtures/ para os testes.

Pare e me mostre o relatório do reconhecimento, com a recomendação de abordagem, antes de implementar a varredura.

2. Varredura
Scripts em coleta/, um adaptador por fonte (coleta/fontes/loga.ts, coleta/fontes/ecourbis.ts, coleta/fontes/reciclasampa.ts) com a mesma interface.

Ritmo educado: 1–2 s aleatórios entre requisições (configurável por variável de ambiente), User-Agent de browser comum, uma requisição por vez.
Retry: 429/503 esperam 30 s, 60 s, 90 s…; erro comum tenta 2 vezes e segue para o próximo item.
Retomada: checkpoint em coleta/progresso.json gravado a cada N itens. Rodar de novo continua de onde parou; apagado ao fim da varredura.
Falhas registradas: itens que falharam vão para coleta/falhas.json e um comando roda só eles de novo.
Playwright, se usado: centralizar num createBrowser() (stealth, viewport realista, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo'). Navegar com domcontentloaded + waitForSelector, não networkidle. Não definir funções nomeadas dentro de page.evaluate (o tsx/esbuild injeta __name, que não existe no browser). Em varredura longa, detectar queda do browser (Target closed, Page crashed, has been closed), reabrir e repetir o mesmo item; não deixar o computador entrar em repouso.
Recicla Sampa: raspar a lista bairro → empresa uma vez; serve de conferência e de fallback para CEPs sem resultado.
3. Dados gerados
Pasta site/dados/, versionada:

setores.json: id do setor → empresa, coleta comum e coleta seletiva (dias e horário/turno), já normalizados;
cep/{5 primeiros dígitos}.json: CEP → setor. Quando o mesmo CEP tiver setores diferentes por numeração, guardar as faixas ([{ de: 1, ate: 999, lado: 'impar', setor: 'L-123' }, …]);
bairros.json: bairro normalizado → empresa (do Recicla Sampa), para o fallback;
meta.json: data da varredura e totais.
Formato sugerido de horário normalizado:

interface Coleta {
  dias: ('seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom')[]
  turno?: 'diurno' | 'noturno'
  horario?: string // texto como o site publica, ex.: "a partir das 19h"
}
interface Setor {
  empresa: 'Loga' | 'Ecourbis'
  comum: Coleta
  seletiva?: Coleta // ausente = rua sem coleta seletiva
}
Parte o arquivo por prefixo para o celular baixar só alguns KB. Script de validação ao fim: CEPs sem setor, setores sem horário, CEP em dois setores sem faixa, contagem por empresa comparada com o Recicla Sampa.

4. Site
Requisitos do resumo, sem negociar:

Uma página só, sem framework pesado, carregamento rápido em internet móvel fraca, funcionando bem em celular.
Campo de CEP grande (inputmode="numeric", máscara 00000-000), um botão, resultado em letras grandes; português simples, sem termos técnicos; contraste alto e alvos de toque grandes (público idoso).
Fluxo: valida o CEP → baixa cep/{prefixo}.json → se precisar, pede o número da casa → mostra coleta comum e seletiva, empresa, link oficial e "dados de mm/aaaa".
CEP inválido: mensagem clara. CEP fora de São Paulo: os 5 primeiros dígitos já dizem se é da capital (faixa 01000–05999 e 08000–08499); mensagem clara.
CEP da capital sem dado na varredura: consultar o ViaCEP direto do navegador (aceita CORS) para obter o bairro, cruzar com bairros.json e mostrar qual empresa atende, o link da página de consulta dela e exatamente o que digitar lá. Nunca uma tela de erro seca.
Conteúdo complementar: o que é reciclável, Ecopontos/PEVs, Central 156.
Sem login, sem analytics, sem guardar o CEP (nem em localStorage).
5. Testes
Parsers testados com as fixtures reais do reconhecimento.
npm run checar-fontes: consulta real com 3 CEPs conhecidos (um da Loga, um da Ecourbis, um de bairro atendido pelas duas) e compara com o que está em site/dados/. Serve para descobrir se os horários mudaram ou se o site da fonte mudou de formato.
Teste do site no celular (viewport mobile) com os mesmos CEPs.
Como trabalhar
Reconhecimento (1a, 1b, 1c) → relatório + recomendação. Pare e me mostre.
Adaptadores com testes de fixture.
Varredura de amostra (um bairro de cada empresa) e conferência manual.
Varredura completa + validação dos dados.
Site.
Teste de ponta a ponta no celular.
Publicação e link final para o QR Code.
Ao fim de cada etapa, atualize o CLAUDE.md do projeto com o que foi descoberto (endpoints, headers, armadilhas ⚠️, decisões e o porquê) e com o passo a passo para rodar a varredura de novo no futuro.