import React from "react";
import Platform from "./Platform";
import { createRoot } from "react-dom/client";
import "semantic-ui-css/semantic.min.css";
import "./styles/index.css";

/**
 * Main React entrypoint
 */
const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Platform />
  </React.StrictMode>
);
