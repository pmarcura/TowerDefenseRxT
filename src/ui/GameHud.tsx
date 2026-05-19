import type { CSSProperties } from "react";
import { getPlayerClassDefinition } from "../game/data/playerClasses";
import { getSkillEffectTotals } from "../game/data/skills";
import { getTowerDefinition, getTowerDefinitionsForClass } from "../game/data/towers";
import { towerProgression } from "../game/data/towerProgression";
import { waveDefinitions } from "../game/data/waves";
import { gameUiBridge } from "../game/bridge/RewardBridge";
import type { GameState, PlayerId, TowerDefinition, TowerEntity } from "../game/models/types";
import { gridKey, isGridOnPath, isInsideGrid } from "../game/utils/grid";

type GameHudProps = {
  state: GameState;
};

type BuildStatus =
  | { tone: "ready"; title: string; detail: string }
  | { tone: "blocked"; title: string; detail: string }
  | { tone: "short"; title: string; detail: string };

const playerLabels: Record<PlayerId, string> = {
  p1: "P1",
  p2: "P2"
};

const playerControls: Record<
  PlayerId,
  { move: string; cycle: string; build: string; inspect: string; ready: string }
> = {
  p1: { move: "WASD", cycle: "Q/E ou 1-9", build: "SPACE", inspect: "F", ready: "R" },
  p2: {
    move: "SETAS",
    cycle: "PGUP/PGDN",
    build: "ENTER",
    inspect: "SHIFT",
    ready: "BACKSPACE"
  }
};

export const GameHud = ({ state }: GameHudProps) => {
  if (state.phase === "menu" || state.phase === "class-selection") {
    return null;
  }

  const wave = waveDefinitions[state.wave.currentWaveIndex];

  return (
    <aside className="game-hud" aria-label="HUD de jogo">
      <section className="hud-objective" aria-label="Estado da wave">
        <div className="objective-primary">
          <span className="objective-kicker">{getPhaseLabel(state)}</span>
          <strong>{wave?.name ?? "Run completa"}</strong>
        </div>
        <div className="objective-track">
          <span>Base {state.baseHp}/{state.activeMap.baseHp}</span>
          <span>Wave {Math.min(state.wave.currentWaveIndex + 1, waveDefinitions.length)}/{waveDefinitions.length}</span>
          <span>{getWaveStatus(state)}</span>
        </div>
        {!state.wave.active && state.phase === "playing" ? (
          <div className="ready-sync-strip">
            <span className={state.wave.readyPlayers.p1 ? "ready" : ""}>P1</span>
            <span className={state.wave.readyPlayers.p2 ? "ready" : ""}>P2</span>
          </div>
        ) : null}
      </section>

      <PlayerCommandPanel playerId="p1" state={state} />
      <PlayerCommandPanel playerId="p2" state={state} />

      <section className="hud-quick-manual" aria-label="Ajuda rápida">
        <span>1. Mova o cursor</span>
        <span>2. Escolha torre</span>
        <span>3. Construa fora da rota</span>
        <strong>Torres sobem ate LV {towerProgression.maxLevel} quando finalizam inimigos</strong>
      </section>
    </aside>
  );
};

const PlayerCommandPanel = ({ playerId, state }: { playerId: PlayerId; state: GameState }) => {
  const cursor = state.cursors[playerId];
  const availableTowers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
  const selectedTower = availableTowers[cursor.selectedTowerIndex % availableTowers.length];
  const selectedCost = getTowerCost(state, playerId, selectedTower.id);
  const buildStatus = getBuildStatus(state, playerId, selectedTower, selectedCost);
  const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
  const stats = state.combatStats[playerId];
  const notice = state.playerNotices[playerId];
  const ownedTowers = state.towers.filter((tower) => tower.ownerId === playerId);
  const towerUnderCursor = state.towers.find((tower) => gridKey(tower.grid) === gridKey(cursor.grid));
  const classAccent = `#${playerClass.accent.toString(16).padStart(6, "0")}`;
  const classSecondary = `#${playerClass.secondaryAccent.toString(16).padStart(6, "0")}`;

  return (
    <section
      className={`player-command-panel player-command-${playerId}`}
      style={
        {
          "--player-accent": classAccent,
          "--player-secondary": classSecondary
        } as CSSProperties
      }
      aria-label={`Painel ${playerLabels[playerId]}`}
    >
      <header className="player-command-head">
        <div>
          <span>{playerLabels[playerId]}</span>
          <strong>{playerClass.shortName}</strong>
          <small>{playerClass.visualMotif}</small>
        </div>
        <div className="player-wallet">
          <strong>{state.economies[playerId].credits}</strong>
          <span>CRED</span>
        </div>
      </header>

      <div className={`build-callout ${buildStatus.tone}`}>
        <strong>{buildStatus.title}</strong>
        <span>{notice ? `${notice.title}: ${notice.detail}` : buildStatus.detail}</span>
      </div>

      {towerUnderCursor ? (
        <button
          className="inspect-button"
          type="button"
          onClick={() => gameUiBridge.openTowerInspection(playerId)}
        >
          INSPECIONAR TORRE ({playerControls[playerId].inspect})
        </button>
      ) : null}

      {!state.wave.active && state.phase === "playing" ? (
        <button
          className={state.wave.readyPlayers[playerId] ? "ready-button is-ready" : "ready-button"}
          type="button"
          disabled={state.wave.readyPlayers[playerId]}
          onClick={() => gameUiBridge.setPlayerReady(playerId)}
        >
          {state.wave.readyPlayers[playerId]
            ? "PRONTO"
            : `DAR PRONTO (${playerControls[playerId].ready})`}
        </button>
      ) : null}

      <section className="selected-tower-card">
        <div className="selected-tower-top">
          <span>{selectedTower.role}</span>
          <strong>{selectedCost} CRED</strong>
        </div>
        <h2>{selectedTower.name}</h2>
        <p>{selectedTower.summary}</p>
        <div className="tower-difference">{selectedTower.differentiator}</div>
      </section>

      <TowerQuickMenu playerId={playerId} state={state} ownedTowers={ownedTowers} />

      <section className="player-metrics" aria-label="Desempenho do jogador">
        <Metric label="Dano wave" value={Math.round(stats.waveDamageDealt)} />
        <Metric label="Kills" value={stats.kills} />
        <Metric label="Torres" value={stats.towersBuilt} />
        <Metric label="Sigilos" value={state.skillTrees[playerId].bossSigils} />
      </section>

      <footer className="player-controls">
        <span>{playerControls[playerId].move} mover</span>
        <span>{playerControls[playerId].cycle} torre</span>
        <span>{playerControls[playerId].inspect} inspecionar</span>
        <strong>{playerControls[playerId].build} construir</strong>
      </footer>
    </section>
  );
};

const TowerQuickMenu = ({
  playerId,
  state,
  ownedTowers
}: {
  playerId: PlayerId;
  state: GameState;
  ownedTowers: TowerEntity[];
}) => {
  const availableTowers = getTowerDefinitionsForClass(state.playerClasses[playerId]);
  const selectedIndex = state.cursors[playerId].selectedTowerIndex % availableTowers.length;

  return (
    <section className="tower-quick-menu" aria-label="Menu rápido de torres">
      {availableTowers.map((tower, index) => {
        const cost = getTowerCost(state, playerId, tower.id);
        const ownedOfType = ownedTowers.filter((ownedTower) => ownedTower.typeId === tower.id);
        const highestLevel = ownedOfType.reduce((max, ownedTower) => Math.max(max, ownedTower.level), 0);
        const affordable = state.economies[playerId].credits >= cost;
        const keyLabel = getTowerKeyLabel(playerId, index);

        return (
          <div
            key={tower.id}
            className={[
              "tower-menu-slot",
              index === selectedIndex ? "selected" : "",
              affordable ? "affordable" : "expensive"
            ].join(" ")}
            style={{ "--tower-color": `#${tower.color.toString(16).padStart(6, "0")}` } as CSSProperties}
          >
            <div className="tower-menu-code">{towerCode(tower.effect)}</div>
            <div>
              <strong>{tower.shortName}</strong>
              <span>{cost} CRED</span>
            </div>
            <small>
              {keyLabel} · {ownedOfType.length > 0
                ? `x${ownedOfType.length} · LV ${highestLevel}`
                : "nova"}
            </small>
          </div>
        );
      })}
    </section>
  );
};

const getTowerKeyLabel = (playerId: PlayerId, index: number): string => {
  if (playerId === "p1") {
    return index < 9 ? `${index + 1}` : "Q/E";
  }

  return index === 0 ? "Pg" : "Pg";
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const getTowerCost = (state: GameState, playerId: PlayerId, towerId: string): number => {
  const tower = getTowerDefinition(towerId);
  const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
  const skillEffects = getSkillEffectTotals(playerId, state.skillTrees[playerId].skillRanks);

  return Math.ceil(tower.cost * playerClass.costMultiplier * skillEffects.costMultiplier);
};

const getBuildStatus = (
  state: GameState,
  playerId: PlayerId,
  tower: TowerDefinition,
  cost: number
): BuildStatus => {
  const cursor = state.cursors[playerId];
  const availableCredits = state.economies[playerId].credits;

  if (!state.wave.active && state.wave.readyPlayers[playerId]) {
    return { tone: "ready", title: "VOCE ESTA PRONTO", detail: "aguardando o outro jogador" };
  }

  if (!isInsideGrid(cursor.grid, state.activeMap)) {
    return { tone: "blocked", title: "POSICAO INVALIDA", detail: "cursor fora do mapa" };
  }

  if (isGridOnPath(cursor.grid, state.activeMap)) {
    return { tone: "blocked", title: "ROTA BLOQUEADA", detail: "construa nas celulas escuras" };
  }

  const towerUnderCursor = state.towers.find(
    (candidate) => gridKey(candidate.grid) === gridKey(cursor.grid)
  );

  if (towerUnderCursor) {
    return {
      tone: "ready",
      title: "TORRE SELECIONADA",
      detail:
        towerUnderCursor.ownerId === playerId
          ? "inspecione para gastar pontos"
          : "torre do outro jogador"
    };
  }

  if (availableCredits < cost) {
    return {
      tone: "short",
      title: `FALTAM ${cost - availableCredits} CRED`,
      detail: `${tower.shortName} custa ${cost}; voce tem ${availableCredits}`
    };
  }

  return {
    tone: "ready",
    title: "PRONTO PARA CONSTRUIR",
    detail: `${tower.shortName} cobre ${tower.role.toLowerCase()}`
  };
};

const getPhaseLabel = (state: GameState): string => {
  if (state.phase === "paused") {
    return "Pausado";
  }

  if (state.phase === "reward-selection") {
    return "Recompensa";
  }

  if (state.phase === "victory") {
    return "Vitoria";
  }

  if (state.phase === "defeat") {
    return "Derrota";
  }

  return state.wave.active ? "Combate" : "Preparacao";
};

const getWaveStatus = (state: GameState): string => {
  if (state.wave.active) {
    return `${state.enemies.length} ameacas em campo`;
  }

  if (state.wave.completed) {
    return "run concluida";
  }

  if (state.wave.readyPlayers.p1 && state.wave.readyPlayers.p2) {
    return `entrando em ${(state.wave.nextWaveInMs / 1000).toFixed(1)}s`;
  }

  const waitingFor = [
    state.wave.readyPlayers.p1 ? null : "P1",
    state.wave.readyPlayers.p2 ? null : "P2"
  ].filter(Boolean);

  return `aguardando ${waitingFor.join(" + ")}`;
};

const towerCode = (effect: string): string => {
  if (effect === "damage") {
    return "LAS";
  }

  if (effect === "slow") {
    return "SLO";
  }

  if (effect === "splash") {
    return "AOE";
  }

  return "CHN";
};
