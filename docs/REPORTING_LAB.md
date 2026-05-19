# Aegis Lab

O Aegis Lab unifica balanceamento, IA jogadora, BugHunter e dados de aprendizado em um pacote local e open source.

## Comando principal

```bash
npm run lab:report
```

Opções úteis:

```bash
npm run lab:report -- --balance-runs 1200 --ai-bot greedy --ai-episodes 1000 --bughunter-episodes 1000 --seed 14729
```

## Saídas

- `reports/lab/dashboard.html`: interface offline com gráficos, prioridades e tabelas.
- `reports/lab/latest.json`: relatório completo serializado.
- `reports/lab/latest.md`: resumo legível para issue, PR ou changelog.
- `reports/lab/learning-dataset.jsonl`: dataset local para heurísticas de bot, regressão e análise IA opcional.
- `reports/learning/champion-policy.json`: melhor política gerada pelo treino evolutivo.
- `reports/ai/learning-dataset.jsonl`: tradução de partidas headless em amostras de aprendizado.

Os relatórios gerados ficam ignorados pelo Git para evitar ruído, arquivos grandes e dados acidentais. A ferramenta que gera os relatórios é versionada.

## Segurança

- Sem CDN.
- Sem chamadas de rede.
- Sem chave OpenAI no repositório.
- Sem login, ranking ou dados pessoais.
- O dashboard é um HTML estático com CSS/JS inline e dados locais.

## Uso para IA

O JSONL possui linhas pequenas e explícitas:

- `episode_outcome`: ensina o bot quais estados levam a vitória, derrota ou timeout.
- `wave_pressure`: mostra quais waves matam, vazam ou precisam de ajuste.
- `tower_usage`: indica torres subusadas, dominantes ou saudáveis.
- `qa_invalid_action`: guarda exemplos de ações inválidas e erros esperados.
- `design_insight`: transforma recomendações em ações de design.

Para autoaprendizado ativo, rode `npm run ai:train`. O Aegis Lab continua sendo a leitura unificada; o treino gera a política campeã.

OpenAI pode ser conectado depois como analista opcional: resumir o JSON, comparar versões e sugerir issues. A IA não joga em tempo real e não precisa de tela para aprender.

## Critérios de leitura

- `healthScore`: pontuação agregada de estabilidade, balanceamento e QA.
- `releaseReadiness`: estado do build para publicação/playtest.
- `balanceWinRate`: deve mirar 50-70% para bots intermediários.
- `qaInvariantFailures`: precisa ser 0 antes de mexer em conteúdo grande.
- `underusedTowerCount`: alerta de torres que precisam de identidade, custo ou descrição melhor.

## Próximo passo técnico

Conectar o Phaser ao mesmo contrato `GameAction` usado pelo laboratório. Quando isso acontecer, jogador humano, bot parceiro, simulação e replay vão usar a mesma regra.
