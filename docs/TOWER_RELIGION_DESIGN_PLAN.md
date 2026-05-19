# Plano De Torres Por Religiao

## Objetivo

Cada classe precisa jogar de forma diferente e ser reconhecida visualmente em menos de tres segundos. As torres devem nascer de objetos, arquitetura, musica e padroes importantes de cada tradicao, evitando representacoes literais sensiveis.

## Novos Tipos De Gameplay

Para suportar torres mais interessantes sem quebrar o tower defense, precisamos preparar estes efeitos:

- `summon`: cria aliado temporario que anda contra a rota e bloqueia/danifica inimigos.
- `aura`: buffa torres proximas ou debuffa inimigos em area.
- `cleanse`: remove escudo, reduz armadura ou apaga adaptacao tecnologica.
- `mark`: marca inimigo para receber mais dano do time.
- `ritual-zone`: cria zona no caminho por alguns segundos.
- `redirect`: empurra ou atrasa um inimigo sem travar boss.
- `income`: renda durante combate, ja implementado.

## Cristianismo

Direcao visual: vitrais, sino, nave, luz, manuscrito, cavalaria medieval como fantasia historica, nao figura sagrada.

Torres:

- Lente de Vitral: dano direto de luz. Clara, precisa, boa para iniciantes.
- Coro de Ressonancia: corrente sonora entre inimigos.
- Sino da Nave: slow em pulsos.
- Oficina de Vitral: renda de manutencao.
- Ordem de Cavaleiros: `summon`. Envia cavaleiros aliados pela rota no sentido contrario. Eles batem em drones e seguram poucos alvos. Nao devem ser invenciveis nem bloquear boss por muito tempo.
- Manuscrito Iluminado: `mark`. Marca inimigos tecnologicos; ataques seguintes causam bonus.

## Umbanda

Direcao visual: ponto cantado, pemba abstrata, guias, vela, roda, casa de apoio. Sem personificar entidades.

Torres:

- Ponto Cantado: corrente rapida.
- Lanterna de Guia: dano barato.
- Risco de Pemba: slow/ritual-zone no chao.
- Casa de Apoio: renda.
- Roda de Gira: `aura`. Torres proximas ganham cadencia quando inimigos entram no raio.
- Defumador Tatico: `cleanse`. Reduz escudos tecnologicos e armadura temporaria.

## Islamismo

Direcao visual: mihrab, zellige, minarete, geometria, mercado/oficio. Sem caligrafia sagrada e sem figura profetica.

Torres:

- Mihrab Fractal: anti-tanque preciso.
- Prisma Zellige: corrente geometrica.
- Pulso do Minarete: splash de area.
- Bazar Geometrico: renda.
- Compasso de Astrolabio: `mark`. Calcula fraqueza de boss e aumenta dano em alvo grande.
- Patio de Simetria: `aura`. Torres em padrao alinhado ganham alcance.

## Hinduismo

Direcao visual: lotus, diya, mandala, yantra abstrato, sino, ciclo. Sem representar divindades como arma.

Torres:

- Ressonador Mandala: slow.
- Chakra de Lotus: corrente.
- Chama Diya: area barata.
- Jardim de Lotus: renda.
- Concha de Pulso: `redirect`. Empurra inimigos leves para tras em pequena distancia.
- Yantra Solar: `ritual-zone`. Zona que aumenta dano contra enxames.

## Budismo

Direcao visual: stupa, roda do dharma, bodhi, lamparina, caminho, silencio. Sem representar Buda.

Torres:

- Stupa de Silencio: slow longo.
- Roda do Caminho: corrente estavel.
- Lampada Bodhi: dano simples.
- Jardim Bodhi: renda.
- Sino de Atencao: `aura`. Reduz cooldown de torres proximas quando poucos inimigos passam.
- Ponte do Meio: `redirect`. Alterna foco de inimigos marcados, comprando tempo sem dano alto.

## Xintoismo

Direcao visual: torii, omamori, kagura, lanternas, papel, madeira, agua. Sem caricaturar kami.

Torres:

- Portal Torii de Harae: slow forte.
- Sino Kagura: corrente curta.
- Amuleto Omamori: dano preciso.
- Jardim de Lanternas: renda.
- Corda Shimenawa: `cleanse`. Remove buffs tecnologicos de inimigos.
- Passagem Vermelha: `ritual-zone`. Cria zona curta que revela rota e aumenta dano na entrada.

## Candomble

Direcao visual: atabaque, contas, folhas, roda, chama, ritmo. Evitar transformar orixas em unidades/armas.

Torres:

- Tambor de Axe: area ritmica.
- Circulo de Contas: corrente forte.
- Fogo do Xire: anti-boss.
- Casa de Folhas: renda.
- Toque de Atabaque: `aura`. Aumenta dano de torres em ritmo, alternando janelas fortes.
- Folha de Corte: `cleanse`. Reduz armadura e remove firewall de alvos.

## Implementacao Recomendada

1. Expandir `TowerEffect` para efeitos compostos.
2. Criar `AllySystem` para unidades invocadas na rota.
3. Criar `StatusEffectSystem` para mark, cleanse, aura e ritual-zone.
4. Mover descricoes de torre para textos curtos: "O que faz", "Boa contra", "Cuidado".
5. Adicionar renderer por familia visual: glass, rhythm, geometry, lotus, wheel, torii, bead.
6. Criar snapshots para bot/simulador entender summons e auras.

## Regra De Balanceamento

Toda torre nova precisa ter:

- funcao primaria;
- fraqueza clara;
- counter ou sinergia;
- impacto visual unico;
- custo inicial;
- curva de XP;
- comportamento no simulador headless.
