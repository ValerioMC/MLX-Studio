import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { initRuntimeConfig } from "@/lib/api/client";
import { queryClient } from "@/lib/api/queries";
import "@/stores/ui";
import "./styles/globals.css";

async function bootstrap() {
  await initRuntimeConfig();
  const root = document.getElementById("root");
  if (!root) throw new Error("index.html is missing #root");
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
