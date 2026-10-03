import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { solve } from './mst.js';

const app = express();
app.set('trust proxy', 1); // Render/Railway sit behind a proxy
app.use(helmet());

const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({ origin: origins, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '200kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

// ---------- validation ----------
const NodeSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(['source', 'building']),
  x: z.number().finite(),
  y: z.number().finite(),
  label: z.string().max(40).optional(),
});

const nodesRule = (nodes: z.infer<typeof NodeSchema>[], ctx: z.RefinementCtx) => {
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length)
    ctx.addIssue({ code: 'custom', message: 'Node ids must be unique.' });
  if (!nodes.some((n) => n.type === 'source'))
    ctx.addIssue({ code: 'custom', message: 'At least one power source is required.' });
};

const NodesSchema = z.array(NodeSchema).min(2, 'Add a source and at least one building.').max(500).superRefine(nodesRule);

const SolveSchema = z.object({
  algorithm: z.enum(['kruskal', 'prim']).default('kruskal'),
  nodes: NodesSchema,
  maxWireLength: z.number().positive().nullish(),
});

const ProjectSchema = z.object({
  nodes: z.array(NodeSchema).max(500),
  algorithm: z.enum(['kruskal', 'prim']).default('kruskal'),
  maxWireLength: z.string().max(20).default(''),
  rate: z.number().finite().nonnegative().default(1000),
});

// ---------- storage (in memory; swap for Postgres/Mongo/Supabase when you need persistence) ----------
const projects = new Map<string, unknown>();
const MAX_PROJECTS = 5000;

// ---------- routes ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.post('/api/solve', (req, res) => {
  const body = SolveSchema.parse(req.body);
  res.json(solve(body.nodes, { algorithm: body.algorithm, maxWireLength: body.maxWireLength ?? null }));
});

app.post('/api/projects', (req, res) => {
  const project = ProjectSchema.parse(req.body);
  if (projects.size >= MAX_PROJECTS) projects.delete(projects.keys().next().value as string);
  const id = randomBytes(5).toString('hex');
  projects.set(id, project);
  res.status(201).json({ id });
});

app.get('/api/projects/:id', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  res.json(project);
});

// ---------- errors ----------
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: err.issues.map((i) => i.message).join(' ') });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`GridMST API listening on :${port}`));
