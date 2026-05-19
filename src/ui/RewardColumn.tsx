import { getSkillDefinition, getSkillRank } from "../game/data/skills";
import { getPlayerClassDefinition } from "../game/data/playerClasses";
import type { PlayerId } from "../game/models/types";
import { rewardBridge } from "../game/bridge/RewardBridge";
import { RewardOption } from "./RewardOption";

const playerLabels: Record<PlayerId, string> = {
  p1: "P1",
  p2: "P2"
};

const playerKeyLabels: Record<PlayerId, string> = {
  p1: "Z",
  p2: "Enter"
};

export const RewardColumn = ({ playerId }: { playerId: PlayerId }) => {
  const state = rewardBridge.getState();
  const rewardSelection = state.rewardSelection;
  const skillTree = state.skillTrees[playerId];
  const playerClass = getPlayerClassDefinition(state.playerClasses[playerId]);
  const playerChoices = rewardSelection?.choices[playerId];
  const selectedSkillId = playerChoices?.selectedSkillId ?? null;
  const isDone = Boolean(selectedSkillId);

  return (
    <section className={`reward-column reward-column-${playerId}`}>
      <div className="reward-column-head">
        <div>
          <h2>
            {playerLabels[playerId]} {playerClass.shortName}
          </h2>
          <p>
            Sigilos {skillTree.bossSigils} · Atalho {playerKeyLabels[playerId]}
          </p>
        </div>
        <span className={isDone ? "reward-status reward-status-done" : "reward-status"}>
          {isDone ? "Escolhido" : "Pendente"}
        </span>
      </div>

      <div className="reward-options">
        {playerChoices?.skillIds.length ? (
          playerChoices.skillIds.map((skillId, index) => (
            <RewardOption
              key={skillId}
              playerId={playerId}
              skill={getSkillDefinition(skillId)}
              rank={getSkillRank(skillTree.skillRanks, skillId)}
              selected={selectedSkillId === skillId}
              disabled={isDone}
              hotkey={index === 0 ? playerKeyLabels[playerId] : null}
            />
          ))
        ) : (
          <div className="reward-empty">Árvore completa para este jogador.</div>
        )}
      </div>
    </section>
  );
};
