# Aegis Sacra TD

> Tower Defense co-op com IA que aprende. Phaser 4 + TypeScript + WebSocket multiplayer.

**Fantasia:** Classes inspiradas em tradições religiosas do mundo (cristã, candomblé, islâmica, hindu, budista, shinto) defendem memória, arquitetura, rito e comunidade contra uma facção tecnológica de drones, máquinas e bosses robôs.

---

## Para Agentes de IA

> Esta seção documenta a arquitetura para que agentes de IA possam navegar, modificar e estender o projeto de forma eficaz.

### Mapa do Repositório

```
src/
  main.ts                        # Entry point — configura Phaser.Game
  game/
    scenes/
      BootScene.ts               # Carrega assets básicos
      PreloadScene.ts            # Carrega todos os assets do jogo
      MainMenuScene.ts           # Menu principal com 4 modos
      GameScene.ts               # Orquestra sistemas + renderers; lança UIScene
      UIScene.ts                 # HUD paralela (roda em cima do GameScene)
      OnlineLobbyScene.ts        # Lobby multiplayer com chat integrado
    systems/                     # Lógica de jogo (atualização por frame, sem render)
      WaveSystem.ts              # Spawna inimigos, controla timer entre ondas
      TowerSystem.ts             # Disparo, detecção de alvos, aplicação de dano
      EnemySystem.ts             # Movimento por path, colisão com base
      EconomySystem.ts           # Créditos, sigils de boss
      SkillTreeSystem.ts         # Recompensas de boss, skill ranks
      AiPartnerSystem.ts         # Decide ações do bot parceiro (build/upgrade/ready)
      BuildSystem.ts             # Construção/venda de torres pelo jogador
      AudioSystem.ts             # Eventos de audio via PresentationEvents
      StatusEffectSystem.ts      # Slow, mark, armor reduction por timer
      AllySystem.ts              # Torres summoners (aliados que andam no path)
    renderers/                   # Desenho puro — sem lógica de jogo
      PhaserHudRenderer.ts       # HUD completo: timeline, status, overlays, inspect
      GridRenderer.ts            # Grid do mapa, highlight de cursor
      TowerRenderer.ts           # Torres com range ring e animação de disparo
      EnemyRenderer.ts           # Inimigos com barra de HP e flash de dano
      FxRenderer.ts              # Eventos visuais: kill burst, crit, income, build
      AmbientParticleRenderer.ts # Partículas de fundo
    models/
      types.ts                   # TODOS os tipos TypeScript (GameState, entidades, etc)
    data/
      towers.ts                  # Definições de todas as torres por classe
      enemies.ts                 # Definições de todos os inimigos
      waves.ts                   # Sequência de ondas com grupos e intervalos
      skills.ts                  # Árvore de skills com efeitos numéricos
      map.ts                     # Mapas, paths e estágios
      playerClasses.ts           # 7 classes de jogador com specialties e bônus
    network/
      protocol.ts                # Tipos WS: OnlineClientMessage, OnlineServerMessage
      OnlineClient.ts            # Cliente WebSocket singleton (onlineClient)
      onlineSession.ts           # Cria MultiplayerSessionConfig a partir do lobby
    config/
      constants.ts               # GAME_WIDTH, GAME_HEIGHT, constantes globais
      BalanceConfig.ts           # Parâmetros de balanceamento editáveis
    bridge/
      RewardBridge.ts            # Bridge entre sistemas e input do jogador
    GameRegistry.ts              # State manager singleton — fonte da verdade
  ai/
    bots/
      ProBot.ts                  # Bot principal com scoring multi-critério
      BossKillerBot.ts           # Foca torres anti-boss
      DefenseBot.ts              # Prioriza cobertura de paths
      EconomyBot.ts              # Maximiza créditos early game
      GreedyBot.ts               # Constrói torres mais caras possíveis
      RandomBot.ts               # Baseline aleatório para comparação
    learning/
      policy.ts                  # Política aprendida (pesos por tipo de ação)
      champion-policy.json       # Pesos da melhor policy treinada até agora
    env/
      TowerDefenseEnv.ts         # Ambiente headless para simulação rápida
    replay/
      ReplayRecorder.ts          # Grava sequência de ações para análise
server/
  multiplayer-server.mjs         # WebSocket server (Node.js + ws)
scripts/
  ai-train.mjs                   # Treino evolutivo de bots (hill-climbing)
  ai-simulate.mjs                # Simulação em batch headless
tools/
  balance-playground.html        # Painel de balanceamento visual no browser
.planning/
  PROJECT.md                     # Contexto, decisões e scope do projeto
  ROADMAP.md                     # Fases planejadas e pendentes
  REQUIREMENTS.md                # Requirements com IDs rastreáveis (REQ-ID)
  STATE.md                       # Estado atual do desenvolvimento GSD
```

### State Central: GameState

Todo o estado do jogo vive em `GameRegistry.getInstance().state` (tipo `GameState` em `src/game/models/types.ts`).

**Campos críticos:**
```typescript
phase: "menu" | "class-selection" | "playing" | "paused" | "reward-selection" | "victory" | "defeat"
wave: WaveState          // active, nextWaveInMs, notice (tone: "start"|"complete"|"boss"|"danger")
baseHp: number           // HP da base sagrada
baseHitFlashMs: number   // Timer de flash ao tomar dano (>0 = recebeu dano recentemente)
lastBaseDamage: number   // Dano do último hit na base (para calibrar shake)
enemies: EnemyEntity[]   // Inimigos vivos no campo
towers: TowerEntity[]    // Torres construídas (com ownerId, branchRanks, skillPoints)
projectiles: ProjectileEntity[]
economies: Record<PlayerId, PlayerEconomyState>   // credits por jogador
skillTrees: Record<PlayerId, SkillTreeState>       // bossSigils + skillRanks
combatStats: Record<PlayerId, PlayerCombatStatsState>
presentationEvents: PresentationEvent[]  // Consumidos por FxRenderer + AudioSystem
aiPartner: AiPartnerState                // lastDecision, decisionsLogged
runSummary: RunStats | null              // Preenchido ao fim da run
```

### Convenções do Código

| Regra | Detalhe |
|-------|---------|
| Sistemas não renderizam | `GameSystem.update(deltaMs)` só modifica estado |
| Renderers não modificam estado | Recebem `state` readonly, desenham e só |
| Canal de efeitos | `GameRegistry.pushPresentationEvent()` para visuais/audio |
| Bridge de input | `gameUiBridge` conecta UI → sistemas (build, reward, class) |
| Idioma | Textos do jogo em PT-BR; código em inglês |
| HUD | Tudo via `PhaserHudRenderer` (React completamente removido) |

### Como Rodar

```bash
npm install
npm run dev          # Jogo: http://localhost:5173
npm run server       # WebSocket server multiplayer: ws://localhost:8787
npm run ai:train     # Treinar bots (headless Node.js)
npm run ai:simulate  # Simular partidas em batch
```

### Adicionando Features

- **Nova torre:** adicionar em `src/game/data/towers.ts` + asset em `PreloadScene`
- **Novo inimigo:** `src/game/data/enemies.ts` + asset + grupo em `waves.ts`
- **Nova skill:** `src/game/data/skills.ts` (template com efeito numérico)
- **Nova onda:** `src/game/data/waves.ts` (grupos com `enemyTypeId`, `count`, `intervalMs`)
- **HUD novo elemento:** adicionar método `drawXxx()` em `PhaserHudRenderer`
- **Novo bot:** implementar `BotStrategy` em `src/ai/bots/`, registrar em `AiPartnerSystem`

---

## Modos de Jogo

| Modo | Descrição | Jogadores |
|------|-----------|-----------|
| **Solo + IA** | Você é P1, IA aprende e joga como P2 | 1 humano + 1 bot |
| **Co-op Local** | Dois jogadores no mesmo teclado | 2 humanos |
| **Lobby Online** | Multiplayer via WebSocket, salas com código 5 letras | 2-12 |
| **AI Playground** | Painel de simulação e treino de bots | Automático |

---

## Classes de Jogador

| Classe | Origem Cultural | Specialty |
|--------|----------------|-----------|
| Vitrail Custodian | Catedral cristã | Dano em área (splash) |
| Gira Medium | Candomblé/Umbanda | Aliados summoners no path |
| Zellige Geometer | Islâmico | Economia de créditos |
| Dharma Weaver | Hindu | Ritual zones e auras |
| Middle Path | Budista | Chain e redirect |
| Torii Keeper | Shinto | Slow e support |
| Axé Guardian | Candomblé | Mark e dano crítico |

---

## Sistema de IA

### Como a IA Decide

O `AiPartnerSystem` avalia ações a cada ciclo com scoring ponderado:

```
score_build    = cobertura_path × dano_potencial × (créditos / custo)
score_upgrade  = kills_da_torre × skill_points_disponíveis
score_ready    = ameaça_da_próxima_onda × tempo_restante
score_hold     = créditos_atuais / créditos_target
```

Os pesos são ajustados pelo treino evolutivo e salvos em `champion-policy.json`.

### Treino

```bash
npm run ai:train          # Hill-climbing nos pesos de decisão
npm run ai:simulate       # Batch de simulações para análise de balanceamento
npm run lab:report        # Relatório HTML com métricas das runs
```

O agente começa com pesos default do `ProBot`, simula partidas no ambiente headless (`TowerDefenseEnv`), compara win-rates e substitui os pesos apenas quando melhora.

### Progresso da IA

Veja [CHANGELOG.md](./CHANGELOG.md) — seção **AI Progress** — para o histórico de win-rate e decisões por versão.

---

## Arquitetura de Rede

```
Browser ──── WebSocket ────► multiplayer-server.mjs ◄──── WebSocket ──── Outros browsers
(OnlineClient.ts)                 Node.js + ws
```

**Mensagens do cliente:** `create-room`, `join-room`, `leave-room`, `select-class`, `set-ready`, `start-room`, `add-bot`, `fill-bots`, `remove-bot`, `clear-bots`, `chat`, `game-action`

**Mensagens do servidor:** `connected`, `room-state`, `room-started`, `game-action`, `chat`, `error`

---

## Changelog

Veja [CHANGELOG.md](./CHANGELOG.md) para patch notes detalhados e progresso da IA.

---

## Licença

Projeto privado / portfólio — github.com/pmarcura
