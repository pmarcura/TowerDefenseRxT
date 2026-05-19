import type { PlayerId, SkillDefinition } from "../game/models/types";
import { rewardBridge } from "../game/bridge/RewardBridge";

type RewardOptionProps = {
  playerId: PlayerId;
  skill: SkillDefinition;
  rank: number;
  selected: boolean;
  disabled: boolean;
  hotkey: string | null;
};

export const RewardOption = ({
  playerId,
  skill,
  rank,
  selected,
  disabled,
  hotkey
}: RewardOptionProps) => {
  const nextRank = Math.min(rank + 1, skill.maxRank);
  const canClick = !disabled && rank < skill.maxRank;

  return (
    <button
      className={`reward-option rarity-${skill.rarity}${selected ? " reward-option-selected" : ""}`}
      type="button"
      disabled={!canClick}
      onClick={() => rewardBridge.selectReward(playerId, skill.id)}
    >
      <span className="reward-option-top">
        <span className="reward-option-name">{skill.name}</span>
        <span className="reward-rarity">{skill.rarity}</span>
      </span>
      <span className="reward-option-desc">{skill.description}</span>
      <span className="reward-option-bottom">
        <span>
          Rank {nextRank}/{skill.maxRank} · {skill.branch}
        </span>
        <span>
          {hotkey ? `${hotkey} · ` : ""}
          {skill.costSigils}S
        </span>
      </span>
    </button>
  );
};
