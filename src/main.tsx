import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

(async () => {
  if (typeof window === "undefined") return;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (registration) => {
          try { await registration.update(); } catch (e) {}
          try { await registration.unregister(); } catch (e) {}
        })
      );
    }
    if (window.caches) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch (e) {}
})();

createRoot(document.getElementById("root")!).render(<App />);
