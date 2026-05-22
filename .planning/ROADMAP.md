# Roadmap — Aegis Sacra TD

**Milestone 1: Polish & Feature Completion**
3 fases | 11 requirements | Foco: game feel, flow, lobby, performance

---

## Phase 1: Game Feel & Wave Flow

**Goal:** Adicionar feedback visual e de audio que torna o jogo mais responsivo e satisfatorio — sem mudar mecanicas.

**Requirements:** FEEL-01, FEEL-02, FEEL-04, FLOW-01

**Plans:**
1. `camera-shake.md` — Phaser camera shake ao tomar dano na base (ligar `state.baseHitFlashMs` com `cameras.main.shake`)
2. `overlay-tweens.md` — Tweens de entrada suave nos overlays HUD (pausa, reward, summary) via `this.scene.tweens`
3. `wave-flash.md` — Flash de borda de tela ao completar wave e matar boss (similar ao base-hit-flash existente em UIScene)
4. `wave-forecast-hud.md` — Mover wave forecast para sempre visivel no HUD inferior (remover guard `if (!state.debug)` em UIScene)

**Success Criteria:**
1. Base recebe dano → camera tremida visivel (intensidade proporcional ao dano)
2. Abrir pausa → overlay desliza/aparece com tween (~200ms), fechar → fade out
3. Wave completa → flash verde suave na borda da tela por 600ms
4. Boss morto → flash rosa na borda da tela por 800ms
5. HUD inferior sempre mostra proxima wave e ameaca, mesmo sem debug ativo

**Depends on:** (none)
**UI hint:** yes

---

## Phase 2: Visual Depth & Performance

**Goal:** Adicionar particulas por inimigo/torre, boss warning cinematico, tela de resultado rica e otimizar projéteis com pooling.

**Requirements:** FEEL-03, FLOW-02, FLOW-03, PERF-01, AI-01

**Plans:**
1. `enemy-death-particles.md` — Phaser 4 ParticleEmitter por tipo de inimigo ao morrer (cor e forma distintas)
2. `boss-warning-sequence.md` — Sequencia cinematica: tela escurece, titulo "BOSS INCOMING", countdown animado com tween de escala
3. `run-summary-polish.md` — Tela vitoria/derrota com metricas animadas: contadores de dano, torres, wave, tempo (tween de numero)
4. `projectile-pool.md` — Substituir criacao/destruicao de projéteis por Phaser.GameObjects.Group com reuse
5. `ai-decision-history.md` — Ultimas 5 decisoes da IA compactas no painel direito (scrolling vertical simples)

**Success Criteria:**
1. Inimigo morre → burst de 6-12 particulas na cor do tipo por 400ms
2. Boss wave prestes a comecar → overlay cinematico de 2s com titulo e countdown
3. Tela de vitoria/derrota → numeros sobem de 0 ate valor real com tween de 1.5s
4. Projéteis reutilizados (sem new/destroy por frame em waves densas)
5. AI panel mostra historico das ultimas 5 acoes com timestamp

**Depends on:** Phase 1
**UI hint:** yes

---

## Phase 3: Online Lobby Polish

**Goal:** Transformar OnlineLobbyScene de placeholder para UI jogavel: slots de jogadores, ready system e chat basico.

**Requirements:** LOBBY-01, LOBBY-02

**Plans:**
1. `lobby-player-grid.md` — Grid de 12 slots (4 colunas x 3 linhas) com avatar, nome e status de classe escolhida
2. `lobby-ready-system.md` — Botao "Pronto" por jogador, indicador de quantos prontos, inicio automatico quando todos prontos
3. `lobby-chat.md` — Area de chat com 5 linhas visiveis, input de texto, Enter para enviar, broadcast via WebSocket

**Success Criteria:**
1. Lobby mostra ate 12 slots, slots vazios tem aparencia de "aguardando jogador"
2. Jogador clica "Pronto" → slot muda de cor, contador "X/N prontos" atualiza
3. Todos prontos → countdown de 3s antes de iniciar GameScene
4. Chat envia e recebe mensagens em tempo real via WS
5. Lobby funciona sem conexao WS (modo local preview com bots preenchendo slots)

**Depends on:** Phase 1
**UI hint:** yes

---

## STATE

- Current Phase: 1
- Status: planning
- Last Updated: 2026-05-21
