import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import ReactGA from "react-ga4";
import { getClientID, getVersion } from './utils/app'


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function disableContextmenu() {
  if (window.location.hostname !== 'tauri.localhost') {
      return
  }
  document.addEventListener('contextmenu', e => {
      e.preventDefault();
      return false;
  }, { capture: true })
}

disableContextmenu()

// ga4
;(async () => {
  const GAID = "G-QTHN28P1Q3"
  try {
      const cid = await getClientID()
      const version = await getVersion()
      ReactGA.initialize([{
          trackingId: GAID,
          gaOptions: {
              app_version: version,
              clientId: cid
          },
          gtagOptions: {
              app_version: version,
              clientId: cid
          }
      }])
  } catch (e) {
      ReactGA.initialize(GAID)
      throw e
  }
})()
