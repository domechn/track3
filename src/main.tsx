import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "./style.css";
import { trackEventWithClientID } from "./utils/app";
import { isIOS } from "./utils/platform";

const MobileApp = React.lazy(() => import("@/mobile/App"));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  isIOS() ? <React.Suspense fallback={null}><MobileApp /></React.Suspense> : <App />,
);

// track event
trackEventWithClientID("app_started");
