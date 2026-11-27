# Printing Architecture Rules

- All receipt print entry points route through the shared `directPrint` orchestrator and ESC/POS builders rather than calling `window.open` directly; when a thermal printer is live-connected to the website it prints silently without opening a new tab, and when disconnected or unreachable it automatically falls back to opening the receipt page in a new tab.