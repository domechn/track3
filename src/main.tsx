import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "./style.css";
import { trackEventWithClientID } from "./utils/app";
import { isIOS } from "./utils/platform";

const App = React.lazy(() => isIOS() ? import("@/mobile/App") : import("@/App"));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.Suspense fallback={null}><App /></React.Suspense>,
);

// track event
trackEventWithClientID("app_started");
