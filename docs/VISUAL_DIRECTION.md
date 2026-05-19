# Aegis Sacra TD - Direcao Visual

## Tese

A fantasia central e: comunidades espirituais defendem memoria, cuidado, rito, arquitetura, musica e simbolos de continuidade contra uma tecnologia que virou sistema autonomo de vigilancia, extracao e apagamento cultural.

O inimigo nao deve ser "outra religiao" nem uma caricatura de ateismo. O inimigo e tecnologia sem humanidade:

- drones de vigilancia;
- maquinas industriais;
- firewalls moveis;
- enxames nanobot;
- arquivistas de dados;
- bosses robos que simulam culto, controle e obediencia.

## Regras De Respeito Religioso

- Nao representar figuras sagradas como armas ou mascotes.
- Nao usar textos sagrados reais como textura, dano, piada ou particula.
- Usar arquitetura, materiais, padroes, objetos, musica, movimento e luz como referencia.
- Sempre preferir abstracao visual a copia literal de rito.
- Cada classe deve parecer culturalmente distinta sem reduzir a tradicao a um unico estereotipo.

## Inimigos Tecnologicos

| Tipo | Nome visual | Funcao | Leitura rapida |
| --- | --- | --- | --- |
| runner | Drone Ceifador | pressao rapida | seta mecanica, olho central, luz verde |
| tank | Tanque Industrial | vida e armadura | corpo pesado, trilhos, chapa laranja |
| shield | Firewall Movel | escudo | escudo digital roxo, linhas de bloqueio |
| swarm | Enxame Nanobot | quantidade | varios nodos pequenos ligados |
| oracle-drone | Drone de Vigilancia | analise e velocidade | olho/camera, antenas, azul frio |
| synthetic-archivist | Arquivista de Dados | adaptacao e armadura | servidor ambulante, linhas de dados |
| boss-reliquary | Boss: Robo Idolatrico | chefe | corpo humanoide mecanico, nucleo rosa, bracos/circuitos |

## Torre Como Primeiro Plano

As torres sao os objetos mais importantes do jogo. A leitura deve seguir esta ordem:

1. tipo da torre e dono;
2. nivel e se tem ponto disponivel;
3. efeito principal;
4. linha de evolucao dominante;
5. detalhe artistico.

Nao mostrar todos os detalhes em todas as torres ao mesmo tempo. O estado normal deve ser silhueta + material + leve assinatura de classe. O estado em foco mostra aneis, pips, XP, branch e range.

## Linguagem Visual Premium

### Materiais

- vidro e luz para Cristianismo;
- giz, vela, contas e gesto circular para Umbanda;
- azulejo, metal polido e geometria modular para Islamismo;
- lotus, chama, yantra abstrato e ciclo para Hinduismo;
- madeira clara, bronze, roda e silencio para Budismo;
- madeira vermelha, papel, sino e lanternas para Xintoismo;
- contas, folhas, tambor e chama ritmica para Candomble.

### Movimento

- Torres: idle lento, respiracao visual baixa, foco quando inspecionada.
- Inimigos: mecanico, angular, sem "vida organica".
- Boss: entrada com travamento de tela leve, pulso de nucleo e alerta sonoro.
- UI: transicoes curtas, sem glow constante.

## Problemas Visuais Atuais

- Muita torre em campo cria ruído mesmo depois da reducao de labels.
- Rotas e torres ainda usam acentos fortes demais simultaneamente.
- O jogador precisa de uma camada "modo estrategico" para ver alcance/branches sem poluir o combate.

## Proximo Padrao De Render

Cada torre deve ter tres niveis de detalhe:

- `ambient`: sprite compacto, sem texto, brilho baixo.
- `focus`: range, level, XP, branch dominante e descricao curta.
- `inspect`: menu radial com arte maior, arvore e comparativo de stats.

Esse padrao deve virar API do renderer, nao decisao espalhada por cena.
