import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameOverlayApp } from "./GameOverlayApp";
import "./overlay.css";

export const mountUi = (): void => {
  const rootElement = document.getElementById("ui-root");

  if (!rootElement) {
    throw new Error("UI root element not found");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <GameOverlayApp />
    </StrictMode>
  );
};
