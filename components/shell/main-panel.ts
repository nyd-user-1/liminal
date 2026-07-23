// The floating white panel's DOM id (app-shell <main>, position: relative).
// Full-container surfaces — the org Map's expanded mode — portal into it and
// fill it with absolute inset-0. Plain module (no "use client") so BOTH the
// server-side shell and code-split client chunks can import the id without
// pulling each other's module graphs along.
export const MAIN_PANEL_ID = "main-content-panel";
