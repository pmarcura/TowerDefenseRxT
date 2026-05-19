# Aegis Sacra TD

Tower defense co-op local em Phaser 4, TypeScript e Vite.

Fantasia atual: classes inspiradas em tradicoes religiosas defendem memoria, arquitetura, rito, musica e comunidade contra uma faccao tecnologica de drones, maquinas, firewalls e bosses robos.

## Rodar

```bash
npm install
npm run dev
```

## Simulação E QA

```bash
npm run ai:simulate -- --bot greedy --episodes 1000
npm run ai:simulate -- --bot pro --episodes 1000
npm run ai:simulate -- --bot pro --episodes 1000 --target-waves 20
npm run ai:train -- --target-waves 20
npm run ai:simulate -- --policy reports/learning/champion-policy.json --episodes 1000
npm run ai:simulate -- --bot bughunter --episodes 1000
npm run simulate:balance -- --runs 1200
npm run lab:report
npm run ai:analyze-report
```

Relatórios locais:

- `reports/lab/dashboard.html`
- `reports/lab/latest.md`
- `reports/lab/learning-dataset.jsonl`
- `reports/learning/dashboard.html`
- `reports/learning/champion-policy.json`
- `reports/ai/dashboard.html`
- `reports/ai/latest.md`
- `reports/ai/learning-dataset.jsonl`
- `reports/ai/analysis.md`

Leia tambem:

- `docs/AI_SELF_LEARNING.md`
- `docs/ENDLESS_AND_AI_DATA.md`
- `reports/balance/latest.md`

## Controles

- P1: WASD move cursor, Q/E troca torre, Space constrói.
- P1: Z escolhe a opção destacada no overlay pós-boss.
- P2: setas move cursor, PageUp/PageDown troca torre, Enter constrói.
- P2: Right Shift inspeciona torre, Backspace pronto/auto, PageUp/PageDown troca torre.
- F3 alterna debug.
- F2 avanca wave em debug.
- R reinicia depois de vitoria ou derrota.

## Estado atual

- Mapas em grid que expandem durante a run.
- Boss rounds com sigilos roguelike.
- Overlay React pós-boss com 3 escolhas por jogador.
- Economia compartilhada por kill/wave e custos por classe.
- Torres por classe religiosa, incluindo dano, slow, splash, chain e renda.
- Torres avançadas por religião com summon, aura, mark, cleanse, redirect e ritual-zone.
- Evolucao de torres por XP de abates e assistencias, sem gastar credito.
- Inimigos tecnologicos: drones, tanques, firewalls, nanobots, arquivistas de dados e bosses robos.
- Laboratório headless com actions serializáveis, replays, invariantes e bots.
- 10 ondas.
- Rotas adicionais em boss/late game.
- Renderização procedural com shapes, glow e partículas.

## Documentos De Produto

- `docs/VISUAL_DIRECTION.md`
- `docs/TOWER_RELIGION_DESIGN_PLAN.md`
- `docs/AI_PLAYTEST_LAB.md`
- `docs/GITHUB_PROJECT_PLAN.md`
