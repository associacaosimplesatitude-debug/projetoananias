import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });

  if (window.caches) {
    void window.caches.keys().then((keys) => {
      keys.forEach((key) => {
        void window.caches.delete(key);
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
