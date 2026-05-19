import { gameUiBridge } from "../game/bridge/RewardBridge";
import type { GameSettings } from "../game/models/types";

type PauseOverlayProps = {
  settings: GameSettings;
};

export const PauseOverlay = ({ settings }: PauseOverlayProps) => (
  <div className="overlay-shell pause-shell" role="dialog" aria-modal="true" aria-label="Jogo pausado">
    <section className="overlay-panel pause-panel">
      <header className="overlay-header">
        <div>
          <p className="overlay-kicker">Pausa</p>
          <h1>Run suspensa</h1>
        </div>
        <p className="overlay-meta">Esc ou P retoma. Ajustes ficam salvos localmente.</p>
      </header>

      <div className="settings-grid">
        <label>
          <span>Volume geral</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.masterVolume}
            onChange={(event) =>
              gameUiBridge.updateSettings({ masterVolume: Number(event.currentTarget.value) })
            }
          />
        </label>
        <label>
          <span>SFX</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.sfxVolume}
            onChange={(event) =>
              gameUiBridge.updateSettings({ sfxVolume: Number(event.currentTarget.value) })
            }
          />
        </label>
        <label>
          <span>Música</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.musicVolume}
            onChange={(event) =>
              gameUiBridge.updateSettings({ musicVolume: Number(event.currentTarget.value) })
            }
          />
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(event) => gameUiBridge.updateSettings({ muted: event.currentTarget.checked })}
          />
          <span>Mutar áudio</span>
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(event) =>
              gameUiBridge.updateSettings({ reducedMotion: event.currentTarget.checked })
            }
          />
          <span>Reduzir movimento</span>
        </label>
      </div>

      <div className="pause-actions">
        <button type="button" onClick={() => gameUiBridge.resume()}>
          Retomar
        </button>
        <button type="button" onClick={() => gameUiBridge.restartRun()}>
          Reiniciar run
        </button>
      </div>
    </section>
  </div>
);
