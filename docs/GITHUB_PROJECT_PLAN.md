# Plano GitHub Publico

## Objetivo

Transformar Aegis Sacra TD em um projeto publico bem explicado, facil de acompanhar e seguro para contribuicoes.

## Branches

- `main`: sempre buildavel.
- `develop`: integracao de features.
- `codex/design-system-and-tech-enemies`: direcao visual, inimigos tecnologicos e docs.
- `feature/ally-summons`: sistema de aliados na rota.
- `feature/bot-playtest-lab`: IA parceira e simulacoes.
- `feature/tower-visual-pass`: sprites finais e renderers de torre.
- `feature/balance-dashboard`: visualizacao de dados.

## Commits Recomendados

1. `chore: initialize public repository metadata`
2. `feat(ai): add deterministic headless action env`
3. `feat(ai): add replay recorder and invariant checks`
4. `feat(ai): add QA and balance bots`
5. `feat(gameplay): add advanced religion tower effects`
6. `docs: define cultural and visual review process`

## Issues Iniciais

- Criar AllySystem para unidades invocadas.
- Criar StatusEffectSystem para mark, aura, cleanse e ritual-zone.
- Criar dashboard HTML de simulacao.
- Criar bot parceiro P2.
- Refinar visual das torres por familia religiosa.
- Balancear waves 8 e 9.
- Reduzir sobra de creditos no late game.
- Revisar textos de religiao com fontes e notas culturais.

## PR Template

Cada PR deve responder:

- O que mudou?
- Qual problema resolve?
- Como foi validado?
- Qual risco de balanceamento?
- Tem impacto cultural/sensivel?

## Bloqueio Atual

No ambiente local atual:

- `.git` foi inicializado localmente;
- `gh` nao esta instalado;
- nao ha remote GitHub configurada;
- config local de usuario pode exigir permissao fora da sandbox.

O caminho seguro e:

1. inicializar repo local;
2. criar branch e commits;
3. instalar/autenticar GitHub CLI ou configurar remote manualmente;
4. fazer push;
5. abrir PR draft.
