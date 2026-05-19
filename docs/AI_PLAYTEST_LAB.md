# Laboratorio De IA E Playtest

## Objetivo

Criar uma IA que sirva em tres modos:

1. parceira local do jogador;
2. bot de QA que joga milhares ou milhoes de partidas headless;
3. analista que gera relatorios de balanceamento, uso de torres, classes e arvores.

## Principio

A IA que joga nao deve depender de LLM em tempo real. O jogo precisa ser deterministico, rapido e barato. LLM pode entrar depois para resumir relatorios, sugerir hipoteses e transformar dados em linguagem de design.

## Arquitetura Proposta

### Camada 1: Simulacao Headless

Implementado agora:

- `src/ai/env/TowerDefenseEnv.ts`;
- `src/game/actions/types.ts`;
- `src/ai/replay/ReplayRecorder.ts`;
- `src/ai/env/invariants.ts`;
- bots `random`, `greedy`, `economy`, `defense`, `bosskiller` e `bughunter`;
- `npm run ai:simulate -- --bot greedy --episodes 1000`;
- dashboard local em `reports/ai/dashboard.html`.

Ainda evoluir:

- `simulate:balance --runs 10000 --profiles all`;
- `simulate:balance --runs 100000 --parallel`;
- seed fixo e seed aleatorio;
- export JSON por run quando debug ligado;
- agregados por classe, torre, wave, rota, branch e decisao.

### Camada 2: Bot Parceiro

Criar `BotPlayerController` com:

- leitura do mesmo snapshot que HUD usa;
- perfis: iniciante, economista, agressivo, suporte, anti-boss;
- capacidade de jogar P1 ou P2;
- respeitar cooldown de decisao para parecer humano;
- explicar no HUD pequenas intencoes: "vou segurar rota 2", "economizando para anti-boss".

### Camada 3: Aprendizado De Politica

Comecar sem rede neural:

- multi-armed bandit para escolher classe/torres;
- busca evolutiva para sequencias de construcao;
- pesos por perfil;
- avaliacao por score: wave alcancada, HP base, dano, custo, sobrando dinheiro, distribuicao de torres.

Depois:

- treinar modelos pequenos offline com logs;
- usar imitation learning a partir dos melhores bots;
- separar "bot parceiro divertido" de "bot otimizador frio".

## Logs Relevantes

Cada run deve registrar:

- seed;
- classes escolhidas;
- torres construidas por jogador;
- ordem de construcao;
- local da torre;
- gasto de creditos;
- renda gerada;
- kills por torre;
- assistencias por torre;
- XP ganho;
- branches compradas;
- dano por wave;
- vazamentos por rota;
- motivo da derrota;
- excesso de dinheiro;
- tempo ate boss;
- rewards escolhidos.

## Dashboard De Dados

Gerar `reports/balance/dashboard.html` com:

- win rate por classe e dupla;
- heatmap de mortes por wave;
- pick rate de torres;
- dano medio por torre;
- ROI de renda;
- mapa de tiles mais usados;
- rotas que mais vazam;
- grafico de XP e nivel por wave;
- comparativo de perfis de bot;
- recomendacoes automáticas.

## Uso De OpenAI

OpenAI pode entrar como analista assistido, nao como jogador frame-a-frame:

- resumir `latest.json` em relatorio de design;
- detectar anomalias;
- gerar issues de balanceamento;
- comparar versoes de simulacao;
- sugerir novos perfis de bot.

Isso deve ficar atras de configuracao opcional `OPENAI_API_KEY`. Sem chave, o laboratorio continua funcionando com analise local.

## Roadmap Tecnico

1. Conectar `KeyboardCoopController` ao mesmo contrato `GameAction`.
2. Criar `BotPlayerController` para parceiro P1/P2 durante gameplay real.
3. Expandir replay com estado antes/depois por ação crítica.
4. Criar teste de regressao de balanceamento com metas por wave.
5. Adicionar comparação entre versões de relatórios.
6. Integrar análise OpenAI opcional quando `OPENAI_API_KEY` e remote GitHub estiverem configurados.
