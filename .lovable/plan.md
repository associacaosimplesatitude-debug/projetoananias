

## Plan: Add "Modo Leitura" (Kindle-style PDF reader) to RevistaLeitura.tsx

**Only file changed:** `src/pages/revista/RevistaLeitura.tsx`

### Changes

1. **New state** — Add `modoKindle` (boolean, default `false`) alongside existing states (~line 74)

2. **Kindle viewer block** — Insert a new conditional render block BEFORE the reader view (before line 288), returning a fullscreen overlay when `modoKindle && revista?.pdf_url`:
   - Fixed overlay with Kindle-style warm background (`#f5f0e8` light / `#1a1a1a` dark)
   - Header with "← Voltar" button, revista title, and night mode toggle
   - PDF iframe with `#toolbar=0&navpanes=0&scrollbar=1&view=FitH`, max-width 800px
   - Night mode applies CSS `filter: invert(1) hue-rotate(180deg)` to iframe

3. **"Modo Leitura" button** — In the lessons list section (~line 612, inside the `<div className="space-y-3">`), add a button ABOVE the progress banner when `revista?.pdf_url` exists:
   - Kindle-themed styling (warm beige/brown colors, adapts to night mode)
   - Text: "Modo Leitura (texto contínuo)"
   - onClick: `setModoKindle(true)`

4. **Reset modoKindle on exit** — Add `setModoKindle(false)` to:
   - `handleLogout` function (line 178)
   - "Voltar às revistas" button onClick (line 541)

5. **Keyboard: ESC exits Kindle** — Update keyboard handler (line 210) to check `modoKindle` first and close it on Escape

