# Contributing to Aegis Sacra TD

Este projeto mistura tower defense, co-op local e direção visual inspirada em religiões de forma respeitosa. Toda contribuição precisa proteger três coisas: jogabilidade clara, simulação determinística e cuidado cultural.

## Antes de abrir PR

1. Rode `npx tsc --noEmit`.
2. Rode `npm run build`.
3. Para balanceamento, rode pelo menos `npm run ai:simulate -- --bot random --episodes 250`.
4. Para mudanças em waves, torres ou economia, rode `npm run simulate:balance -- --runs 1200`.
5. Para mudanças grandes de gameplay, rode `npm run lab:report`.
6. Para conteúdo cultural, explique a inspiração e o que foi evitado.

## Regras de design cultural

- Use arquitetura, objetos, materiais, padrões, música e composição como inspiração.
- Não transforme figuras sagradas em armas, inimigos ou caricaturas.
- Não use texto sagrado real como VFX decorativo.
- Prefira descrições simples, funcionais e respeitosas.

## Regras de arquitetura

- Phaser renderiza e orquestra cenas.
- React fica para overlays externos complexos.
- Regras novas devem ter caminho para simulação headless.
- Dados de balanceamento devem ficar em arquivos de data.
- Não esconda números importantes em sistemas.

## Commits sugeridos

- `feat(gameplay): add tower effect`
- `fix(waves): prevent ready softlock`
- `balance(towers): tune income tower roi`
- `docs(culture): add review note`
- `test(ai): add replay invariant`
