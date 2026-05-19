# IA Autoaprendente

O jogo agora tem uma camada de treino evolutivo para criar políticas mais fortes que bots fixos.

## Filosofia

Inspiração: bots competitivos treinam em massa, erram rápido, preservam campeões e melhoram por pressão de seleção. Aqui isso é aplicado ao tower defense:

- jogo headless determinístico;
- população de políticas;
- curriculum por geração;
- avaliação por vitória, waves, vida restante, erros e timeouts;
- seleção de elites;
- crossover e mutação;
- campeão salvo em JSON.

Não usamos LLM clicando na tela. A IA aprende dentro do simulador.

## Rodar treino

```bash
npm run ai:train
```

Treino mais forte:

```bash
npm run ai:train -- --generations 20 --population 64 --episodes 120 --target-waves 20 --promotion-episodes 600 --seed 14729
```

Treino rápido:

```bash
npm run ai:train -- --generations 4 --population 16 --episodes 30
```

Por padrão, o treino carrega `reports/learning/champion-policy.json` se ele existir. Isso faz a IA continuar a partir da melhor política anterior, em vez de nascer do zero toda vez.

Treino limpo, sem reutilizar campeão:

```bash
npm run ai:train -- --fresh --generations 8 --population 28 --episodes 60
```

Treino com uma política específica como semente:

```bash
npm run ai:train -- --seed-policy reports/learning/champion-policy.json --generations 12 --population 40 --episodes 90
```

`--promotion-episodes` controla a prova final antes de salvar o campeão. Use valores maiores quando o objetivo for superar o bot atual, não apenas achar uma política promissora.
`--target-waves` transforma o modo infinito em objetivo de treino. Aumente esse valor quando a IA estabilizar.

## Saídas

- `reports/learning/champion-policy.json`: melhor política encontrada.
- `reports/learning/latest.md`: relatório de treino.
- `reports/learning/dashboard.html`: visualização da evolução.
- `reports/learning/champion-dataset.jsonl`: linhas úteis para análise e regressão.

## Avaliar campeão aprendido

```bash
npm run ai:simulate -- --policy reports/learning/champion-policy.json --episodes 1000 --target-waves 20
```

Isso roda a política aprendida sem alterar o código-fonte. Quando ela provar estabilidade, podemos promover os pesos para o `ProBot`.

## O que a política aprende

- quando gastar dinheiro;
- quanto reservar;
- quantas torres buscar por wave;
- quando priorizar upgrades;
- quais efeitos valorizam cada ameaça;
- como escolher recompensas pós-boss;
- quais branches de torre priorizar.

## Próximos passos para superar humano

1. Fazer o bot ler e executar `champion-policy.json` diretamente no parceiro em tempo real.
2. Adicionar heatmap de tiles no replay para aprender posicionamento fino.
3. Adicionar oponente curricular: waves mutadas e seeds difíceis.
4. Rodar torneios entre campeões antigos e novos.
5. Criar uma liga permanente com Elo por política.
6. Treinar políticas especializadas por dupla de religiões.

## Regra importante

Um campeão que vence mais mas gera falha de invariante não é promovido. QA vem antes de performance.
