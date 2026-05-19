# Roadmap

## Sprint 2: co-op roguelike foundation

- Mostrar keybinds por jogador durante a partida.
- Separar economia dos jogadores, com custos e recompensas balanceados por classe.
- Adicionar torre `chain` e inimigo `swarm`.
- Criar ondas de boss que entregam sigilos para comprar habilidades.
- Criar uma arvore roguelike inicial com habilidades unicas por jogador.
- Aumentar o mapa e a distancia da rota conforme a run avanca.
- Fazer boss rounds com entradas adicionais conforme a run fica mais longa.
- Melhorar o design visual com rotas multi-lane, paineis melhores, leitura de custo e efeitos.

## Sprint 3: presentation layer

- Usar React para telas externas: menu, selecao de classe, loja pos-boss e ranking.
- Manter Phaser como nucleo de simulacao/render do tabuleiro.
- Preparar Supabase para login, saves, ranking e progresso persistente.

## Sprint 4: art pipeline

- Migrar placeholders para spritesheets e texture atlases.
- Criar particulas por torre e por inimigo.
- Separar temas visuais por tradicao cultural com pesquisa e notas de fonte.
- Evitar simbolos sagrados usados como decoracao generica; priorizar geometria, materiais, musica, arquitetura e padroes historicos.

## Sprint 5: tech faction + sacred object towers

- Transformar todos os inimigos em faccao tecnologica: drones, firewalls, nanobots, arquivistas e bosses robos.
- Criar sistemas novos de torre: summon, aura, cleanse, mark, ritual-zone e redirect.
- Fazer Cristianismo ganhar torre de cavaleiros aliados que sobem a rota contra os inimigos.
- Fazer cada religiao ter pelo menos uma torre com gameplay unico e visual proprio.
- Criar modo de detalhe progressivo para torres: ambient, focus e inspect.

## Sprint 6: AI playtest lab

- Criar bot parceiro opcional para P1/P2.
- Expandir simulador para milhares/milhoes de runs headless.
- Gerar logs por run, agregados por classe, torre, branch, wave e rota.
- Criar dashboard HTML de balanceamento.
- Usar OpenAI opcionalmente para resumir relatorios e sugerir issues.
