# Procedural Infinito E Dados Para IA

Aegis Sacra TD agora trata a campanha principal como sobrevivencia procedural:

- as 10 primeiras waves continuam como abertura autoral;
- depois disso, `getWaveDefinition(index)` gera waves infinitas;
- `getMapStage(index)` expande mapa, distancia de rota e numero de rotas;
- boss aparece a cada 5 waves e libera recompensa roguelike;
- a partida local nao precisa terminar por vitoria: ela escala ate derrota;
- a IA usa `targetWaveCount` para transformar o infinito em desafio mensuravel.

## Comandos

Simular sobrevivencia ate 20 waves:

```bash
npm run ai:simulate -- --bot pro --episodes 1000 --target-waves 20
```

Treinar em sobrevivencia procedural:

```bash
npm run ai:train -- --generations 12 --population 40 --episodes 80 --target-waves 20 --promotion-episodes 600
```

Exportar dataset de aprendizado:

```bash
npm run ai:simulate -- --bot pro --episodes 1000 --target-waves 20 --max-learning-samples 50000
```

Saida principal:

- `reports/ai/learning-dataset.jsonl`
- `reports/learning/champion-policy.json`
- `localStorage["aegis-sacra-learning-samples-v1"]` para partidas jogadas no browser.

## Formato De Aprendizado

Cada linha JSONL tem:

- origem da partida: local, online, IA ou headless;
- fase, wave, ameaca, vida da base;
- classes, creditos, dano, kills e torres por jogador;
- torres construidas, nivel, dano e posicao;
- acao executada quando existir;
- erros ou bloqueios quando existirem.

Isso permite usar partidas humanas, bots, parceiro IA e futuramente multiplayer online como uma unica fonte de treino.

## Multiplayer 2-12

O projeto agora tem `src/game/network/sessionTypes.ts` com o contrato inicial:

- modo local;
- modo online;
- parceiro IA;
- 2 a 12 assentos;
- preenchimento por IA.

A simulacao atual ainda roda P1/P2 no gameplay local. O contrato existe para a proxima etapa: separar `PlayerId` fixo de `PlayerSeatId` dinamico e fazer economia/HUD/input escalarem para ate 12 jogadores.
