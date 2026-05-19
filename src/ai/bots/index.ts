import type { BotId, HeadlessBot } from "./BotTypes";
import { BossKillerBot } from "./BossKillerBot";
import { BugHunterBot } from "./BugHunterBot";
import { DefenseBot } from "./DefenseBot";
import { EconomyBot } from "./EconomyBot";
import { GreedyBot } from "./GreedyBot";
import { ProBot } from "./ProBot";
import { RandomBot } from "./RandomBot";

export const headlessBots: Record<BotId, HeadlessBot> = {
  random: RandomBot,
  greedy: GreedyBot,
  economy: EconomyBot,
  defense: DefenseBot,
  bosskiller: BossKillerBot,
  bughunter: BugHunterBot,
  pro: ProBot
};

export const getHeadlessBot = (botId: string): HeadlessBot =>
  headlessBots[(botId as BotId) in headlessBots ? (botId as BotId) : "random"];

export type { BotId, HeadlessBot } from "./BotTypes";
