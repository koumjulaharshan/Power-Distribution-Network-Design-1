import { describe, expect, it } from 'vitest';
import { buildEdges, kruskal, prim, solve, type GridNode } from './mst';

const S = (id: string, x: number, y: number): GridNode => ({ id, type: 'source', x, y });
const B = (id: string, x: number, y: number): GridNode => ({ id, type: 'building', x, y });

describe('MST', () => {
  it('1 source + 1 building', () => {
    const r = solve([S('s', 0, 0), B('b', 3, 4)], { algorithm: 'kruskal' });
    expect(r.connected).toBe(true);
    expect(r.totalLength).toBe(5);
  });

  it('1 source + 3 buildings on a line picks the chain', () => {
    const nodes = [S('s', 0, 0), B('a', 10, 0), B('b', 20, 0), B('c', 30, 0)];
    expect(solve(nodes, { algorithm: 'kruskal' }).totalLength).toBe(30);
    expect(solve(nodes, { algorithm: 'prim' }).totalLength).toBe(30);
  });

  it('Kruskal and Prim agree on random graphs', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 500;
    for (let t = 0; t < 25; t++) {
      const nodes = [S('s', rnd(), rnd()), ...Array.from({ length: 15 }, (_, i) => B('b' + i, rnd(), rnd()))];
      const e = buildEdges(nodes);
      const k = kruskal(nodes, e).mst.reduce((s, x) => s + x.weight, 0);
      const p = prim(nodes, e).mst.reduce((s, x) => s + x.weight, 0);
      expect(Math.abs(k - p)).toBeLessThan(1e-6);
    }
  });

  it('flags a disconnected graph when wires are length-limited', () => {
    const nodes = [S('s', 0, 0), B('a', 10, 0), B('far', 500, 500)];
    for (const algorithm of ['kruskal', 'prim'] as const) {
      const r = solve(nodes, { algorithm, maxWireLength: 50 });
      expect(r.connected).toBe(false);
      expect(r.unreachable).toEqual(['far']);
    }
  });

  it('multiple sources act as one bus (zero-cost link)', () => {
    const nodes = [S('s1', 0, 0), S('s2', 100, 0), B('a', 10, 0), B('b', 90, 0)];
    expect(solve(nodes, { algorithm: 'kruskal' }).totalLength).toBe(20);
    expect(solve(nodes, { algorithm: 'prim' }).totalLength).toBe(20);
  });

  it('is undirected and tolerates coincident nodes', () => {
    const nodes = [S('s', 0, 0), B('a', 0, 0), B('b', 1, 0)];
    expect(solve(nodes, { algorithm: 'prim' }).totalLength).toBe(1);
  });

  it('reports no connection without a source', () => {
    expect(solve([B('a', 0, 0), B('b', 1, 1)], { algorithm: 'kruskal' }).connected).toBe(false);
  });
});
