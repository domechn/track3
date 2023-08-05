import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import { trackEventWithClientID } from "./utils/app";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function disableContextmenu() {
  if (window.location.hostname !== "tauri.localhost") {
    return;
  }
  document.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
      return false;
    },
    { capture: true }
  );
}

disableContextmenu();

// track event
(async () => trackEventWithClientID("app_started"))();
