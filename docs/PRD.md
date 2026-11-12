# Projeto: Consulta de Coleta de Lixo por CEP (São Paulo)

## Contexto
Este site é parte de um **projeto de extensão universitária** do curso de Análise e Desenvolvimento de Sistemas (Cruzeiro do Sul Virtual), no eixo **Economia Sustentável**, ligado ao **ODS 12 – Consumo e produção responsáveis**.

O site será apresentado **presencialmente** aos moradores de um bairro de São Paulo. O aluno vai de casa em casa, ensina a usar o site no celular e entrega um panfleto com QR Code que leva à página.

## O problema
Em São Paulo, a coleta de lixo (comum e seletiva) é feita por **duas concessionárias**:

- **Loga**, que atende principalmente as regiões Centro, Norte e Oeste e parte da Leste. A consulta fica em: https://www.loga.com.br/pesquisa-de-coleta/
- **Ecourbis**, que atende principalmente as regiões Sul e Leste. A consulta fica em: https://www.ecourbis.com.br/coleta/index.html

Para descobrir o dia e o horário da coleta, o morador hoje precisa:
1. descobrir qual empresa atende o seu bairro, por exemplo pela lista do Recicla Sampa: https://www.reciclasampa.com.br/horarios-de-coleta
2. entrar no site dessa empresa;
3. fazer uma nova pesquisa lá.

Muita gente não sabe disso. O resultado é que coloca o lixo na rua no dia errado e não separa os recicláveis.

## A solução
Uma página simples, em que o morador **digita o CEP** e **recebe direto os dias e horários da coleta** da sua rua, sem precisar saber qual empresa atende.

### Fluxo do usuário
1. O morador acessa a página pelo QR Code do panfleto ou por um link.
2. Digita o CEP.
3. O site identifica o bairro e qual concessionária (Loga ou Ecourbis) atende aquele endereço.
4. O site mostra:
   - os dias e horários da **coleta seletiva** (recicláveis);
   - os dias e horários da **coleta comum** (domiciliar);
   - qual empresa atende e um link para o site oficial dela, para conferência.

### Regras e casos especiais
- **Bairros atendidos pelas duas empresas:** Artur Alvim, Vila Nova Conceição e Brooklin Paulista. Nesses casos, a empresa depende do endereço exato, e o site precisa lidar com isso. Pode, por exemplo, consultar as duas ou pedir o número da casa.
- **CEP inválido ou de fora de São Paulo:** mostrar uma mensagem clara.
- **Se não conseguir obter o horário automaticamente:** o site deve ao menos dizer qual empresa atende e levar o morador direto à página de consulta certa, já com as informações que ele precisa digitar lá.
- A lista de bairros e empresas do Recicla Sampa serve como referência para saber qual empresa atende cada bairro.

## Conteúdo complementar (desejável)
- **O que é reciclável e o que não é**, em linguagem simples.
- **Pontos de entrega voluntária (PEVs) e Ecopontos** próximos, para vidro, óleo, eletrônicos e entulho.
- Contato da **Central 156** da Prefeitura, para reclamações sobre a coleta.

## Público e requisitos de experiência
- O público são moradores comuns, incluindo **idosos e pessoas com pouca familiaridade com tecnologia**.
- O uso será **principalmente no celular**, a partir do QR Code.
- A interface deve ser **muito simples**: um campo de CEP, um botão e o resultado em letras grandes e claras.
- O texto deve estar **em português**, sem termos técnicos.
- A página precisa carregar rápido, inclusive em internet móvel fraca.
- O site precisa ficar **publicado e acessível por um link público**, que será usado no QR Code do panfleto.

## Fora do escopo
- Cadastro ou login de usuários.
- Coleta de dados pessoais. O CEP é usado apenas para a consulta e não é guardado.
- Aplicativo para instalar. É só uma página web.

## Critério de sucesso
Um morador consegue, em menos de 1 minuto e sem ajuda, digitar o CEP e saber em que dia e horário colocar o lixo reciclável e o lixo comum na rua.
