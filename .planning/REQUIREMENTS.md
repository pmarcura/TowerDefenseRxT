# Requirements — Aegis Sacra TD

## v1 Requirements (Milestone: Polish & Feature Completion)

### Game Feel (FEEL)

- [ ] **FEEL-01**: Camera shake ao receber dano na base usando `this.cameras.main.shake()`
- [ ] **FEEL-02**: Tweens de entrada/saida nos overlays (pausa, reward selection, run summary)
- [ ] **FEEL-03**: Particulas Phaser 4 em kills de inimigos (burst de cor por tipo de inimigo)
- [ ] **FEEL-04**: Flash de cor na borda da tela ao completar wave / matar boss

### Game Flow (FLOW)

- [ ] **FLOW-01**: Wave forecast sempre visivel no HUD inferior durante fase "playing" (remover condicional de debug)
- [ ] **FLOW-02**: Sequencia dramatica de boss warning: fade, titulo centralizado, countdown animado
- [ ] **FLOW-03**: Tela de vitoria/derrota com metricas animadas (dano total, torres construidas, tempo, wave alcancada)

### Online Lobby (LOBBY)

- [ ] **LOBBY-01**: OnlineLobbyScene com grid de slots de jogadores (ate 12), indicadores de status e botao ready
- [ ] **LOBBY-02**: Chat simples de lobby (5 mensagens visiveis, input de texto)

### Performance (PERF)

- [ ] **PERF-01**: Object pool para projéteis — Phaser.GameObjects.Group com reuse em vez de criar/destruir

### AI (AI)

- [ ] **AI-01**: Historico compacto das ultimas 5 decisoes da IA visivel no AI panel do HUD

## v2 (Deferred)

- Minimap (canvas offscreen)
- Touch/mobile controls
- Replay system (ReplayRecorder ja existe, precisa de player)
- Leaderboard online
- Editor de ondas no balance playground

## Out of Scope

- Backend persistente — sem login/banco de dados
- Mobile nativo — foco desktop
- Monetizacao — portfolio/indie

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FEEL-01 | Phase 1 | Pending |
| FEEL-02 | Phase 1 | Pending |
| FEEL-03 | Phase 2 | Pending |
| FEEL-04 | Phase 1 | Pending |
| FLOW-01 | Phase 1 | Pending |
| FLOW-02 | Phase 2 | Pending |
| FLOW-03 | Phase 2 | Pending |
| LOBBY-01 | Phase 3 | Pending |
| LOBBY-02 | Phase 3 | Pending |
| PERF-01 | Phase 2 | Pending |
| AI-01 | Phase 2 | Pending |
