# Aegis Sacra TD

## What This Is

Tower Defense co-op com Phaser 4 + TypeScript + Vite. Jogadores defendem a base contra ondas de inimigos, constroem torres, evoluem via skill tree e jogam em diferentes modos: Solo+IA, Co-op Local (2 jogadores no teclado), Lobby Online (2-12 jogadores via WebSocket), e AI Playground (treino/simulacao de bots).

## Context

**Estado atual (brownfield):** jogo funcional com arquitetura ECS-like solida. React UI foi completamente removida e substituida por PhaserHudRenderer puro — migração concluida. Servidor WebSocket para multiplayer esta estruturado mas o lobby online precisa de polish. IA aprende com runs usando bots especializados.

**Stack:** Phaser 4.1+, TypeScript 5.8, Vite 6.3, Node.js/ws para servidor multiplayer.

**Arquitetura:**
- `GameRegistry` — state manager central (singleton)
- `GameScene` — orquestra sistemas e renderers
- `UIScene` — HUD separada (roda em paralelo com GameScene)
- `PhaserHudRenderer` — toda UI de jogo desenhada com Graphics/Text puro
- Sistemas: Wave, Tower, Enemy, Projectile, Economy, SkillTree, AiPartner, Audio, BuildSystem
- Renderers: Grid, Tower, Enemy, Ally, Projectile, Fx, Ambient, ClassSelection, Zone

## Core Value

Experiencia de co-op responsiva e visualmente polida — seja sozinho com IA ou com amigos — onde cada sessao tem progressao clara (skill tree, tower upgrades) e a IA parceira parece inteligente.

## Requirements

### Validated

- ✓ 4 modos de jogo: Solo+IA, Co-op Local, Online Lobby, AI Playground — existente
- ✓ Sistema de ondas com 10+ definicoes, boss waves, escalonamento por jogadores — existente
- ✓ Tower system com branches de upgrade e pontos de skill — existente
- ✓ Skill tree com recompensas de boss (sigils) — existente
- ✓ HUD completo: timeline, status de jogador, quickbar, AI panel, pausa, reward, run summary — existente
- ✓ Tower inspection overlay com auto-upgrade — existente
- ✓ Camera com zoom (scroll) e drag (botao direito) — existente
- ✓ Servidor WebSocket multiplayer (foundation) — existente
- ✓ Bots de IA com aprendizado (ProBot, BossKillerBot, DefenseBot, EconomyBot, etc) — existente
- ✓ Balance playground HTML para simulacoes — existente
- ✓ Audio system com volume controls — existente

### Active

- [ ] FEEL-01: Camera shake ao tomar dano na base (Phaser camera effect)
- [ ] FEEL-02: Tweens de entrada/saida nos overlays HUD (pausa, reward, summary)
- [ ] FEEL-03: Partículas Phaser 4 em kills de inimigos e disparos de torres
- [ ] FEEL-04: Flash de tela em wave complete e boss kill (alem do base hit flash existente)
- [ ] FLOW-01: Wave forecast sempre visivel no HUD (nao apenas em debug mode)
- [ ] FLOW-02: Animacao de boss warning — sequencia dramatica antes do boss wave
- [ ] FLOW-03: Tela de vitoria/derrota com stats animados (atualmente apenas texto)
- [ ] LOBBY-01: OnlineLobbyScene com UI completa: lista de jogadores, slots, chat de texto
- [ ] LOBBY-02: Bots de lobby configuráveis (dificuldade/personalidade)
- [ ] PERF-01: Object pooling para projéteis (Phaser Group reutilizavel)
- [ ] AI-01: Visualizacao da decisao da IA melhorada (historico de acoes no painel)

### Out of Scope

- Mobile/touch nativo — foco em desktop
- Backend persistente (login, leaderboard) — sem backend além do WS local
- Monetizacao — projeto independente/portfolio
- Editor de mapas — mapas hardcoded por design

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phaser 4 puro, sem React | React removido na sessao anterior para eliminar overhead de bridge e reatividade | Concluido — toda UI via PhaserHudRenderer |
| UIScene paralela a GameScene | Permite HUD rodar em scene separada sem bloquear logica | Implementado e funcionando |
| GameRegistry como state manager | Singleton centraliza estado, facil de debugar, evita prop drilling | Padrao consolidado |
| YOLO mode GSD | Usuario quer autonomia maxima no processo | Ativo |

## Evolution

Este documento evolui a cada transicao de fase e milestone.

**Apos cada fase:**
1. Requirements concluidos → mover para Validated com referencia da fase
2. Novos requirements emergidos → adicionar em Active
3. Decisoes importantes → adicionar em Key Decisions

---
*Last updated: 2026-05-21 — inicializacao brownfield*
