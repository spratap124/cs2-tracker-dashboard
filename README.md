# CS2 Tracker Dashboard (Dark mode default)

## Setup (development)
1. Copy and edit `src/api.js` to point to your API (default: http://localhost:3001).
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev` (open http://localhost:5173)

## Build (production)
1. `npm run build`
2. Serve `/dist` via any static server or use provided Dockerfile to build an nginx image:
   `docker build -t cs2-tracker-dashboard . && docker run -p 80:80 cs2-tracker-dashboard`
