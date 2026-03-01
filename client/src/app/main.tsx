import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// SW registration moved to index.html inline script to avoid deadlock
// when stale SW prevents app bundle from loading
