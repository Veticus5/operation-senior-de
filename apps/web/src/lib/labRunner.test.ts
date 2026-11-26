import { describe, expect, it } from 'vitest';
import { applyEvent, createEventParser, endLocally, formatDuration, idleRun, isLocalPage, sha256Hex, type RunEvent } from './labRunner';

const start: RunEvent = { type: 'start', labId: 'x', command: 'uv run x.py', cwd: 'labs', timeoutSec: 300, startedAt: '2026-01-01T00:00:00Z' };

describe('parser strumienia zdarzeń', () => {
  it('składa zdarzenie rozcięte między porcjami', () => {
    const parse = createEventParser();
    expect(parse('{"type":"stdout","da')).toEqual([]);
    expect(parse('ta":"a\\nb"}\n{"type":"stderr","data":"c"}\n{"type"')).toEqual([{ type: 'stdout', data: 'a\nb' }, { type: 'stderr', data: 'c' }]);
    expect(parse(':"end","status":"ok","exitCode":0,"signal":null,"durationMs":5}\n')).toEqual([{ type: 'end', status: 'ok', exitCode: 0, signal: null, durationMs: 5 }]);
  });
  it('pomija puste linie', () => {
    expect(createEventParser()('\n\n{"type":"stdout","data":"a"}\n\n')).toHaveLength(1);
  });
});

describe('stan uruchomienia', () => {
  it('skleja sąsiednie porcje tego samego strumienia i zachowuje kolejność strumieni', () => {
    const events: RunEvent[] = [start, { type: 'stdout', data: 'a' }, { type: 'stdout', data: 'b' }, { type: 'stderr', data: 'warn' }, { type: 'stdout', data: 'c' }];
    const state = events.reduce(applyEvent, idleRun);
    expect(state.status).toBe('running');
    expect(state.command).toBe('uv run x.py');
    expect(state.output).toEqual([{ stream: 'stdout', text: 'ab' }, { stream: 'stderr', text: 'warn' }, { stream: 'stdout', text: 'c' }]);
  });
  it('koniec niesie status, kod wyjścia i czas zmierzony przez runner', () => {
    const state = [start, { type: 'end', status: 'failed', exitCode: 1, signal: null, durationMs: 1234 } as RunEvent].reduce(applyEvent, idleRun);
    expect([state.status, state.exitCode, state.durationMs]).toEqual(['failed', 1, 1234]);
  });
  it('nowy start czyści wyjście poprzedniego uruchomienia', () => {
    const state = [start, { type: 'stdout', data: 'stare' } as RunEvent, start].reduce(applyEvent, idleRun);
    expect(state.output).toEqual([]);
  });
  it('przerwanie po stronie przeglądarki nie nadpisuje wyniku, który już przyszedł', () => {
    const running = applyEvent(idleRun, start);
    expect(endLocally(running, 'cancelled', 900).status).toBe('cancelled');
    const finished = applyEvent(running, { type: 'end', status: 'ok', exitCode: 0, signal: null, durationMs: 5 });
    expect(endLocally(finished, 'cancelled', 900).status).toBe('ok');
  });
});

describe('pomocnicze', () => {
  it('runnera szuka tylko strona otwarta lokalnie', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'app.localhost']) expect(isLocalPage(host), host).toBe(true);
    for (const host of ['example.github.io', 'localhost.example.com', '192.168.1.10', '']) expect(isLocalPage(host), host).toBe(false);
  });
  it('formatuje czas po polsku', () => {
    expect(formatDuration(840)).toBe('0,8 s');
    expect(formatDuration(41234)).toBe('41,2 s');
    expect(formatDuration(125000)).toBe('2 min 05 s');
  });
  it('liczy SHA-256 tak samo jak runner (hex z bajtów UTF-8)', async () => {
    expect(await sha256Hex('zażółć')).toBe('7eefe5e3046c86cec19ce1215e0a04724124d948468005a1ebc4adf2643bea13');
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
