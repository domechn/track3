import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/jetbrains-mono";
import "./style.css";
import { trackEventWithClientID } from "./utils/app";
import { isIOS } from "./utils/platform";

const MobileApp = React.lazy(() => import("@/mobile/App"));

// viewport-fit=cover (safe-area insets) is only needed on iOS. Setting it in index.html
// shifts desktop layout by sub-pixels, so it is applied at runtime on iOS only.
if (isIOS()) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  isIOS() ? <React.Suspense fallback={null}><MobileApp /></React.Suspense> : <App />,
);

// track event
trackEventWithClientID("app_started");
