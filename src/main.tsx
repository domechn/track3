import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "./style.css";
import { trackEventWithClientID } from "./utils/app";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// track event
trackEventWithClientID("app_started");
