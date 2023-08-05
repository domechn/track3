import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import { getClientID, getVersion } from "./utils/app";
import { trackEvent } from "@aptabase/tauri";

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

// ga4
(async () => {
  try {
    const cid = await getClientID();
    trackEvent("app_started", { clientId: cid || "unknown" });
  } catch (e) {
    trackEvent("app_started");
    throw e;
  }
})();
