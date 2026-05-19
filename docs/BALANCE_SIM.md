# Balance Simulation

Headless bot simulation for Aegis Sacra TD. It uses the real data files for waves, maps, enemies, towers, classes and skills, but replaces Phaser rendering with a fast mathematical combat model.

## Commands

```bash
npm run simulate:balance -- --runs 1000 --seed 20260510
npm run simulate:balance:large -- --seed 20260510
```

Optional profile filter:

```bash
npm run simulate:balance -- --runs 2000 --profiles novice,mentor,economist
```

## Outputs

Reports are written to:

- `reports/balance/latest.md`
- `reports/balance/latest.json`
- timestamped `.md` and `.json` files in the same folder

## Bot Profiles

- `novice`: builds fewer towers, prefers cheaper choices and makes noisier decisions.
- `mentor`: balanced player, values range/control.
- `aggressive`: spends earlier and favors damage.
- `economist`: saves more credits and favors efficient builds.
- `experimental`: explores chain/slow and rarer skill choices.

## How To Use

Treat this as a balance radar, not a perfect replay engine. Strong signals:

- win rate above 82% means the run is likely too forgiving;
- win rate below 42% means the run is punishing;
- death spikes identify waves that need count/HP/spawn tuning;
- huge leftover credits means economy has too much slack;
- low tower build share means that tower lacks a clear reason to exist.
