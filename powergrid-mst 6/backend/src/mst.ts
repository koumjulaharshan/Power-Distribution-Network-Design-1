export type NodeType = 'source' | 'building';
export type Algorithm = 'kruskal' | 'prim';

export interface GridNode { id: string; type: NodeType; x: number; y: number; label?: string }
export interface Edge { from: string; to: string; weight: number; virtual?: boolean }
export interface Step { edge: Edge; accepted: boolean }
export interface SolveOptions { algorithm: Algorithm; maxWireLength?: number | null }
export interface SolveResult {
  algorithm: Algorithm;
  connected: boolean;
  components: number;
  totalLength: number;
  starLength: number;
  savingsPct: number;
  unreachable: string[];
  edges: Edge[];
  steps: Step[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export class UnionFind {
  private parent: number[];
  private rank: number[];
  count: number;
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
    this.count = n;
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): boolean {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) this.rank[ra]++;
    this.count--;
    return true;
  }
}

/**
 * Complete undirected graph. Edges between two power sources cost 0 and are
 * flagged "virtual": equivalent to a super-source joined to every real source,
 * so several sources behave as one supply bus.
 * Real edges longer than maxLen are dropped (this is how a graph becomes disconnected).
 */
export function buildEdges(nodes: GridNode[], maxLen?: number | null): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const virtual = a.type === 'source' && b.type === 'source';
      const weight = virtual ? 0 : Math.hypot(a.x - b.x, a.y - b.y);
      if (!virtual && maxLen != null && maxLen > 0 && weight > maxLen) continue;
      edges.push({ from: a.id, to: b.id, weight, virtual });
    }
  }
  return edges;
}

const indexOf = (nodes: GridNode[]) => new Map(nodes.map((n, i) => [n.id, i]));

export function kruskal(nodes: GridNode[], edges: Edge[]) {
  const idx = indexOf(nodes);
  const uf = new UnionFind(nodes.length);
  const mst: Edge[] = [];
  const steps: Step[] = [];
  const sorted = [...edges].sort((a, b) => a.weight - b.weight);
  for (const e of sorted) {
    const accepted = uf.union(idx.get(e.from)!, idx.get(e.to)!);
    steps.push({ edge: e, accepted });
    if (accepted) mst.push(e);
    if (uf.count === 1) break;
  }
  return { mst, steps };
}

export function prim(nodes: GridNode[], edges: Edge[]) {
  const n = nodes.length;
  const idx = indexOf(nodes);
  const adj: { to: number; e: Edge }[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    const a = idx.get(e.from)!, b = idx.get(e.to)!;
    adj[a].push({ to: b, e });
    adj[b].push({ to: a, e });
  }
  const visited = new Array<boolean>(n).fill(false);
  const dist = new Array<number>(n).fill(Infinity);
  const via = new Array<Edge | null>(n).fill(null);
  const mst: Edge[] = [];
  const steps: Step[] = [];
  // grow from sources first, then from any leftover island (a forest if disconnected)
  const roots = [...nodes.keys()].sort((a, b) => Number(nodes[b].type === 'source') - Number(nodes[a].type === 'source'));
  for (const root of roots) {
    if (visited[root]) continue;
    dist[root] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!visited[i] && dist[i] < Infinity && (u === -1 || dist[i] < dist[u])) u = i;
      if (u === -1) break;
      visited[u] = true;
      const edge = via[u];
      if (edge) { mst.push(edge); steps.push({ edge, accepted: true }); }
      for (const { to, e } of adj[u]) if (!visited[to] && e.weight < dist[to]) { dist[to] = e.weight; via[to] = e; }
    }
  }
  return { mst, steps };
}

export function solve(nodes: GridNode[], opts: SolveOptions): SolveResult {
  const edges = buildEdges(nodes, opts.maxWireLength);
  const { mst, steps } = opts.algorithm === 'prim' ? prim(nodes, edges) : kruskal(nodes, edges);

  const idx = indexOf(nodes);
  const uf = new UnionFind(nodes.length);
  for (const e of mst) uf.union(idx.get(e.from)!, idx.get(e.to)!);
  const sources = nodes.filter((n) => n.type === 'source');
  const powered = new Set(sources.map((s) => uf.find(idx.get(s.id)!)));
  const unreachable = nodes.filter((n) => n.type === 'building' && !powered.has(uf.find(idx.get(n.id)!))).map((n) => n.id);

  const totalLength = r2(mst.filter((e) => !e.virtual).reduce((s, e) => s + e.weight, 0));
  const starLength = r2(
    nodes.filter((n) => n.type === 'building').reduce((s, b) => s + Math.min(...sources.map((src) => Math.hypot(src.x - b.x, src.y - b.y))), 0),
  );
  const connected = sources.length > 0 && unreachable.length === 0;
  return {
    algorithm: opts.algorithm,
    connected,
    components: uf.count,
    totalLength,
    starLength,
    savingsPct: connected && starLength > 0 ? r2((1 - totalLength / starLength) * 100) : 0,
    unreachable,
    edges: mst,
    steps,
  };
}
