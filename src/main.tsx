import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "./style.css";
import { trackEventWithClientID } from "./utils/app";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);

// track event
trackEventWithClientID("app_started");
