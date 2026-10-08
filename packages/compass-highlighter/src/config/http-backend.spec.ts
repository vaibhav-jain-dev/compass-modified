import { expect } from 'chai';
import { HttpConfigBackend } from './http-backend';

describe('HttpConfigBackend', function () {
  function fakeServer(initial: { exists: boolean; text: string }) {
    const state = { ...initial, mtimeMs: 1, requests: [] as string[] };
    const fetchFn = ((input: string, init?: RequestInit) => {
      state.requests.push(`${init?.method ?? 'GET'} ${input}`);
      if (init?.method === 'PUT') {
        state.text = String(init.body);
        state.exists = true;
        state.mtimeMs += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      const body = {
        path: '/srv/highlighter.yaml',
        exists: state.exists,
        mtimeMs: state.exists ? state.mtimeMs : null,
        ...(input.includes('meta=1') ? {} : { text: state.text }),
      };
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200 })
      );
    }) as unknown as typeof fetch;
    return { state, fetchFn };
  }

  it('reads, writes and reports the server-side path', async function () {
    const { state, fetchFn } = fakeServer({ exists: true, text: 'a: 1\n' });
    const backend = new HttpConfigBackend('/highlighter/config', fetchFn);
    expect(await backend.exists()).to.equal(true);
    expect(backend.path).to.equal('/srv/highlighter.yaml');
    expect(await backend.readText()).to.equal('a: 1\n');
    await backend.writeText('b: 2\n');
    expect(state.text).to.equal('b: 2\n');
    expect(state.requests).to.deep.equal([
      'GET /highlighter/config?meta=1',
      'GET /highlighter/config',
      'PUT /highlighter/config',
    ]);
  });

  it('propagates server errors', async function () {
    const backend = new HttpConfigBackend('/x', (() =>
      Promise.resolve(new Response(null, { status: 500 }))) as typeof fetch);
    let error: Error | null = null;
    try {
      await backend.exists();
    } catch (err) {
      error = err as Error;
    }
    expect(error?.message).to.match(/500/);
  });
});
