# GridMST – minimum-wire power distribution

Place power sources and buildings on a canvas; the app connects everything with the
**minimum spanning tree** (Kruskal or Prim) so total wire length is as small as possible.

- Static-first: the solver runs in the browser, so GitHub Pages is enough.
- Optional Express API: `/api/solve` and shareable saved projects.
- Several sources are treated as one supply bus (zero-cost virtual links = super-source).
- "Max wire length" removes long edges, so unreachable buildings trigger a clear warning.

## Run locally
The frontend has **no build step**: open `frontend/index.html` in a browser (or `npx serve frontend`).
The page solves everything in the browser, including the river terrain option.
Optional backend (`/api/solve`, saved projects): `cd backend && npm install && npm run dev`; `npm test` runs its tests.
The API does not know about the river multiplier yet.

## API
| Method | Path | Body / result |
|---|---|---|
| GET | `/api/health` | `{ ok: true }` |
| POST | `/api/solve` | `{ algorithm, nodes[], maxWireLength? }` → `{ connected, totalLength, edges[], steps[], unreachable[], savingsPct }` |
| POST | `/api/projects` | project JSON → `{ id }` |
| GET | `/api/projects/:id` | project JSON |

Node: `{ "id": "S1", "type": "source" | "building", "x": 0, "y": 0 }`.

## Deploy
1. **Frontend:** repo Settings → Pages → Source = *GitHub Actions*; push to `main`. No Node or base-path setup needed.
2. **Backend (optional):** create a Render web service from `render.yaml` and set `CORS_ORIGIN` to `https://<user>.github.io`.
