# Changelog — Aegis Sacra TD

> Patch notes para humanos e agentes de IA. Versões seguem o formato `v0.MILESTONE.PATCH`.

---

## [v0.4.0] — 2026-05-21 · Game Feel + Lobby Chat + Documentação

### Novidades

**Game Feel**
- Camera shake na base ao receber dano — intensidade proporcional ao dano sofrido (`lastBaseDamage / 30`, clampado entre 0.003–0.014)
- Overlay de transição de fase com tween de fade-in (entranceFlash, 220 ms)
- Flash de borda verde ao completar onda, rosa ao matar boss (curva de sino quadrática `t*(1-t)*4`)
- Previsão de onda (`WaveForecast`) sempre visível durante gameplay — removida restrição debug
- Aviso de boss com painel alargado (620 px) e animação de pulso senoidal em tempo real
- Kill burst com 8 raios radiais rotativos adicionados ao efeito de explosão

**Lobby Online**
- Chat em tempo real no lobby multiplayer — full-stack (protocolo → servidor → cliente → UI)
- Mensagens exibidas em painel compacto (96 px, 5 linhas visíveis + campo de input)
- Input integrado ao sistema de foco de campos existente no `OnlineLobbyScene`

**Documentação**
- `README.md` reescrito para humanos e agentes de IA com mapa completo do repositório
- `CHANGELOG.md` criado com patch notes e seção de progresso da IA
- GitHub configurado com remote `TowerDefenseRxT`

### Correções
- `drawWaveForecast` deixou de usar guard de debug — agora usa guard de fase explícito
- `LobbyFieldId` type atualizado para incluir `"chat"` — eliminou type casts desnecessários
- Run summary exibe tempo no formato `MM:SS` em vez de milissegundos brutos

### Arquivos Modificados
```
src/game/scenes/GameScene.ts          — camera shake
src/game/scenes/UIScene.ts            — overlay tween, wave flash, boss pulse
src/game/renderers/FxRenderer.ts      — kill burst rays
src/game/renderers/PhaserHudRenderer.ts — run summary MM:SS
src/game/scenes/OnlineLobbyScene.ts   — chat UI
src/game/network/OnlineClient.ts      — chat API
src/game/network/protocol.ts          — chat message types
server/multiplayer-server.mjs         — broadcastChat
README.md                             — reescrito
CHANGELOG.md                          — criado
```

---

## [v0.3.0] — 2026-05-20 · Lobby Multiplayer + Bots Online

### Novidades
- `OnlineLobbyScene` — cena dedicada para lobby online com WebSocket
- Sistema de assentos (seats): humanos, bots IA, vazios — até 12 jogadores
- Comandos host: `add-bot`, `fill-bots`, `remove-bot`, `clear-bots`
- Auto-start quando todos os humanos estão prontos com classe selecionada
- Relay de `game-action` com autorização por assento (host controla bots)
- Código de sala: 5 letras do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`

---

## [v0.2.0] — 2026-05-19 · Phaser HUD Completo (React Removido)

### Novidades
- `PhaserHudRenderer` — HUD completo em Phaser puro, substituindo React
- Timeline de ondas, status de jogadores, overlays de fase (pausa, recompensa, derrota, vitória)
- Inspeção de torre via click com painel de detalhes
- Seleção de classe renderizada em Phaser
- React e todas as dependências UI removidas do bundle

### Arquivos Removidos
```
src/ui/ClassSelectionColumn.tsx
src/ui/GameOverlayApp.tsx
src/ui/OnlineLobbyOverlay.tsx
src/ui/PauseOverlay.tsx
src/ui/RewardColumn.tsx
src/ui/RewardOption.tsx
src/ui/RunSummaryOverlay.tsx
src/ui/TowerInspectionOverlay.tsx
src/ui/mount.tsx
src/ui/overlay.css
```

---

## [v0.1.0] — 2026-05-18 · Fundação Solo+IA

### Novidades
- `GameScene` + `UIScene` em paralelo (Phaser Scene Manager)
- `GameRegistry` singleton com `GameState` completo
- Sistemas: Wave, Tower, Enemy, Economy, SkillTree, AiPartner, Build, Audio, StatusEffect, Ally
- Renderers: PhaserHud, Grid, Tower, Enemy, Fx, AmbientParticle
- `TowerDefenseEnv` headless para treino de bots
- `ProBot` com scoring multi-critério
- Treino evolutivo hill-climbing (`ai-train.mjs`)
- 7 classes de jogador com bonus e specialties únicos
- 4 modos de jogo: Solo+IA, Co-op Local, Lobby Online, AI Playground

---

## AI Progress

> Histórico de win-rate da IA por versão. Meta: >70% win-rate em dificuldade normal (10 ondas).

| Versão | Win-Rate | Ondas Médias | Notas |
|--------|----------|--------------|-------|
| v0.1.0 | ~42% | 6.2 | ProBot baseline, pesos manuais |
| v0.1.1 | ~51% | 7.1 | Primeiro treino hill-climbing (50 iterações) |
| v0.2.0 | ~58% | 7.8 | Policy salva em `champion-policy.json` |
| v0.3.0 | ~61% | 8.3 | Filtro de conhecimento: bot evita torres sem cobertura de path |
| v0.4.0 | ~61% | 8.3 | Sem mudanças no treino (foco em game feel e lobby) |

### Como a Win-Rate é Medida

```bash
npm run ai:simulate   # Roda N partidas headless, imprime win-rate e média de ondas
npm run ai:train      # Hill-climbing: substitui champion-policy.json apenas se melhorar
npm run lab:report    # Gera relatório HTML com métricas detalhadas por run
```

Cada run simula o `TowerDefenseEnv` headless com o `ProBot` usando os pesos da `champion-policy.json`.
O critério de vitória é sobreviver todas as ondas do mapa com `baseHp > 0`.

### Scoring do ProBot

```
score_build   = cobertura_path × dano_potencial × (créditos / custo)
score_upgrade = kills_da_torre × skill_points_disponíveis
score_ready   = ameaça_da_próxima_onda × tempo_restante
score_hold    = créditos_atuais / créditos_target
```

Os pesos de cada score são os parâmetros ajustados pelo treino.
Ver `src/ai/learning/policy.ts` e `src/ai/learning/champion-policy.json`.

### Proximos Marcos de IA

- [ ] Win-rate 65%: Melhorar heurística de cobertura (considerar upgrades vs novas torres)
- [ ] Win-rate 70%: Adicionar lookahead de 2 ondas na decisão de `score_ready`
- [ ] Win-rate 75%: Ensemble de bots especializados por fase da run
