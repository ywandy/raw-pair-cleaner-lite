import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import { applyThemeTokens, defaultThemeTokens } from "./styles/themeTokens";

applyThemeTokens(document.documentElement, defaultThemeTokens);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
