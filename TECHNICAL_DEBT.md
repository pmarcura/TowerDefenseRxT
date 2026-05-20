# Relatório de Débito Técnico e Incoerências do Projeto

Como especialista em engenharia de software e arquitetura de sistemas, conduzi uma análise profunda do codebase, arquitetura de simulação, estrutura do Git e dependências do projeto. A seguir estão categorizadas todas as inconsistências, códigos problemáticos, obsolescências e gaps arquiteturais encontrados.

---

## 1. Divergências de Fórmulas e Regras de Negócio (Engine vs. Simulador Headless vs. Simulador de Balanceamento)

### 🔴 Omissão Completa de Acertos Críticos (Critical Hits) nas Simulações
* **O Problema:** A mecânica de acertos críticos está implementada no loop real da engine Phaser (`TowerSystem.ts` e `ProjectileSystem.ts` calculam chance de crítico e multiplicadores com base no nível da torre e ramificações de upgrade `rupture` e `focus`). No entanto, os ambientes headless de simulação (`TowerDefenseEnv.ts` para treinamento/teste de IA e `headlessSimulator.ts` para balanceamento do jogo) calculam o dano/DPS de forma puramente determinística e linear, omitindo completamente a existência de críticos.
* **Impacto:**
  1. O simulador de balanceamento subestima o potencial de dano real de torres com alta chance de crítico (especialmente classes baseadas em DPS massivo).
  2. As políticas de IA (`policy.ts`) são treinadas com dados capados, falhando em priorizar upgrades de crítico como `rupture` e `focus` por não haver feedback de recompensa associado a eles na simulação headless.

### 🔴 Código Duplicado de Simulação Matemática
* **O Problema:** As classes `TowerDefenseEnv.ts` (IA) e `headlessSimulator.ts` (Balanceamento) contêm implementações redundantes do modelo matemático simplificado do jogo, incluindo os métodos:
  * `getTowerDamagePerSecond` / `getTowerDamagePerSecond`
  * `getAuraMultiplier` / `getAuraMultiplier`
  * `getControlMultiplier` / `getControlMultiplier`
  * `resolveGroup` / `simulateGroup`
* **Impacto:** Violação direta do princípio **DRY (Don't Repeat Yourself)**. Caso uma mecânica de cálculo de status, aura ou eficiência de dano seja modificada na engine do jogo, o desenvolvedor precisa atualizar manualmente em 3 lugares diferentes (Phaser, Ambiente de IA e Simulador de Balanceamento), criando uma altíssima probabilidade de dessincronização (*model drift*).

---

## 2. Problemas Arquiteturais e de Design (Clean Code)

### 🟡 Efeitos de Status Fragmentados
* **O Problema:** O loop de atualização temporal e redefinição dos status dos inimigos está espalhado:
  * O efeito de **Slow** (`slowTimerMs` e `slowMultiplier`) é atualizado dentro de `EnemySystem.ts`.
  * Os efeitos de **Mark** (`markTimerMs` e `markMultiplier`) e **Cleanse** (`armorReductionTimerMs` e `armorReduction`) são gerenciados pelo `StatusEffectSystem.ts`.
* **Impacto:** Quebra o princípio da **Separação de Conceitos (Separation of Concerns)**. O gerenciamento de efeitos nocivos temporários deveria estar centralizado em uma única entidade de status, simplificando a adição de novos debuffs (como poison, stun, etc.) e facilitando a manutenção e testes.

### 🟡 Acoplamento Excessivo e God Object em `TowerSystem.ts`
* **O Problema:** O `TowerSystem` possui dependências acopladas de `AllySystem`, `ProjectileSystem`, `SkillTreeSystem` e `EconomySystem`. Ele atua orquestrando a injeção física de projéteis, invocando sumons diretamente na rota e gerando recompensas financeiras.
* **Impacto:** Dificulta a escrita de testes unitários isolados e o mock das interações da torre. O ideal seria o `TowerSystem` apenas gerar eventos ou interagir via um barramento/mensageria interna da engine.

### 🟡 Tipos Monolíticos em `types.ts`
* **O Problema:** O arquivo `src/game/models/types.ts` é uma biblioteca monolítica gigante que mistura:
  * Estruturas geométricas de renderização (`Vec2`, `GridPoint`).
  * Definições de entidades de jogo (`EnemyEntity`, `TowerEntity`, `ProjectileEntity`).
  * Tipagens internas do simulador headless, telemetria e configurações de UI.
* **Impacto:** Torna a leitura confusa e gera dependências circulares ocultas quando múltiplos módulos importam o mesmo arquivo monolítico. Deveria ser modularizado em `grid.types.ts`, `entities.types.ts`, `telemetry.types.ts`, etc.

---

## 3. Dependências Ocultas e Configuração de Empacotamento

### 🔴 Dependência de `esbuild` Não Declarada no `package.json`
* **O Problema:** Os scripts utilitários `scripts/ai-simulate.mjs` e `scripts/simulate-balancing.mjs` importam o módulo `esbuild` para compilar sob demanda os arquivos TypeScript dos simuladores. Entretanto, `esbuild` não está listado nas dependências ou devDependencies no `package.json`.
* **Impacto:** O projeto só compila porque o `vite` utiliza o `esbuild` internamente e o instala como dependência transitiva no diretório `node_modules`. Se o `vite` for atualizado para uma versão que altere o empacotador (ou se for migrado para outro bundler como o Rolldown), os scripts utilitários quebram silenciosamente em ambiente de CI/CD ou nova instalação limpa.

---

## 4. Incoerências no Fluxo e Organização do Git

### 🔴 Divergência Total do Fluxo Prescrito
* **O Problema:** O documento `docs/GITHUB_PROJECT_PLAN.md` prescreve um fluxo complexo de desenvolvimento utilizando Git Flow clássico (`main`, `develop` e ramificações `feature/*` com Pull Requests formais). Na realidade:
  * O repositório real possui histórico simplificado composto de ramificações do Codex (`codex/solo-ai-feedback-ui` e `codex/aegis-sacra-foundation`).
  * Não há servidores remotos (`origin`) configurados, tratando-se apenas de um repositório local.
  * O histórico de commits é composto de checkpoints automatizados, sem mensagens descritivas de engenharia humana.

### 🔴 Bug Crítico no Ambiente: Variável `HOME` Mal Configurada
* **O Problema:** A variável de ambiente do sistema operacional está populada incorretamente com a string literal `%USERPROBLE%` (provável typo de `%USERPROFILE%`).
* **Impacto:** O Git tenta ler ou criar arquivos de configuração globais (como o `.gitconfig`) sob caminhos virtuais inexistentes relativos ao repositório local (ex: `c:\Users\pedro\Downloads\Jogo\%USERPROBLE%\.gitconfig`), retornando erros constantes de permissão e propriedade duvidosa (`dubious ownership`), forçando a injeção manual da variável de ambiente `HOME="C:\Users\pedro"` em scripts.

---

## 5. Dessincronização entre Design (Planos) e Implementação

### 🟡 Efeito de Aura da "Roda de Gira" Estático
* **O Problema:** No documento de design `docs/TOWER_RELIGION_DESIGN_PLAN.md`, a torre **Roda de Gira** (classe Umbanda) é descrita como: *"Torres próximas ganham cadência quando inimigos entram no raio"*. Contudo, a lógica codificada no `TowerSystem.ts` (`getAuraEffects`) faz um cálculo puramente estático de distância física entre torres, aplicando o buff de cadência de forma permanente (independentemente de haver inimigos ou combate ativo no raio).

### 🟡 Valores Mágicos (*Magic Numbers*) Hardcoded
* **O Problema:** O arquivo `StatusEffectSystem.ts` insere o valor fixo de `360` ms para a duração dos efeitos de *Mark* e *Cleanse* gerados por zonas rituais, ignorando as propriedades da própria zona e criando um gap de balanceamento oculto.

---

## Recomendações de Ação Rápida
1. **Adicionar `esbuild`** nas `devDependencies` do `package.json` para garantir independência de build.
2. **Refatorar o DPS do Simulador Headless** para calcular matematicamente o impacto de acertos críticos com base na média ponderada (`dps_com_crit = dps_base * (1 + chance_crit * (multiplicador_crit - 1))`), alinhando o balanceamento simulado com o jogo real.
3. **Mover a atualização de `slowTimerMs`** do `EnemySystem` para o `StatusEffectSystem`, unificando a manipulação de status de inimigos em um único local.
4. **Substituir o valor mágico `360`** em `StatusEffectSystem.ts` por referências da definição da zona ou por uma constante descritiva.
