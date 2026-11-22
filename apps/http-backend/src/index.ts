import { app } from "./app.js";

// 🔌 PORT is injected by hosts like Render/Railway; fall back to 3001 locally
const PORT = Number(process.env.PORT) || 3001;

// 🚀 Start the HTTP server (all routes live in src/routes/, wired in app.ts)
app.listen(PORT, () => console.log(`🚀 HTTP Backend running on port ${PORT}`));
