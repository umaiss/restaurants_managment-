// U5 Step 14: the staff session and the 401 reaction (BR1.7, BR1.8).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStaffSession } from '../useStaffSession.js';
import { staffFetch, notifyStaffUnauthorized, onStaffUnauthorized } from '../staffAuth.js';

const json = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useStaffSession: asking before showing a page (BR1.8)', () => {
  it('starts as "checking", then signedIn when the server says 200', async () => {
    fetchMock.mockResolvedValue(json(200, { signed_in: true }));
    const { result } = renderHook(() => useStaffSession());
    expect(result.current.state).toBe('checking');
    await waitFor(() => expect(result.current.state).toBe('signedIn'));
    expect(fetchMock).toHaveBeenCalledWith('/api/staff/session');
  });

  it('is signedOut on a 401', async () => {
    fetchMock.mockResolvedValue(json(401, { error: { code: 'UNAUTHORIZED' } }));
    const { result } = renderHook(() => useStaffSession());
    await waitFor(() => expect(result.current.state).toBe('signedOut'));
  });

  it('is "unreachable" when the server does not answer or answers an error, and recheck tries again', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useStaffSession());
    await waitFor(() => expect(result.current.state).toBe('unreachable'));
    fetchMock.mockResolvedValueOnce(json(500));
    await act(() => result.current.recheck());
    expect(result.current.state).toBe('unreachable');
    fetchMock.mockResolvedValueOnce(json(200, { signed_in: true }));
    await act(() => result.current.recheck());
    expect(result.current.state).toBe('signedIn');
  });
});

describe('useStaffSession: signing in', () => {
  async function ready() {
    fetchMock.mockResolvedValueOnce(json(401, {}));
    const hook = renderHook(() => useStaffSession());
    await waitFor(() => expect(hook.result.current.state).toBe('signedOut'));
    return hook;
  }

  it('a 204 signs in and posts the PIN as JSON', async () => {
    const { result } = await ready();
    fetchMock.mockResolvedValueOnce(json(204));
    let r: unknown;
    await act(async () => {
      r = await result.current.signIn('4242');
    });
    expect(r).toEqual({ ok: true });
    expect(result.current.state).toBe('signedIn');
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe('/api/staff/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ pin: '4242' });
  });

  it('a wrong PIN is not a refusal: it stays signed out and reports the tries left', async () => {
    const { result } = await ready();
    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'INVALID_PIN', details: { tries_left: 3 } } }));
    let r: unknown;
    await act(async () => {
      r = await result.current.signIn('0000');
    });
    expect(r).toEqual({ ok: false, code: 'INVALID_PIN', triesLeft: 3 });
    expect(result.current.state).toBe('signedOut');
  });

  it('a 429 is LOCKED with the seconds to wait (60 when the server gives none)', async () => {
    const { result } = await ready();
    fetchMock.mockResolvedValueOnce(json(429, { error: { code: 'LOCKED', details: { retry_after_seconds: 42 } } }));
    let r: unknown;
    await act(async () => {
      r = await result.current.signIn('4242');
    });
    expect(r).toEqual({ ok: false, code: 'LOCKED', retryAfterSeconds: 42 });
    fetchMock.mockResolvedValueOnce(json(429));
    await act(async () => {
      r = await result.current.signIn('4242');
    });
    expect(r).toEqual({ ok: false, code: 'LOCKED', retryAfterSeconds: 60 });
  });

  it('a server error or no answer is ERROR, never a wrong-PIN message', async () => {
    const { result } = await ready();
    let r: unknown;
    fetchMock.mockResolvedValueOnce(json(500));
    await act(async () => {
      r = await result.current.signIn('4242');
    });
    expect(r).toEqual({ ok: false, code: 'ERROR' });
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      r = await result.current.signIn('4242');
    });
    expect(r).toEqual({ ok: false, code: 'ERROR' });
    expect(result.current.state).toBe('signedOut');
  });
});

describe('useStaffSession: signing out and refusals (BR1.7)', () => {
  async function signedIn() {
    fetchMock.mockResolvedValueOnce(json(200, { signed_in: true }));
    const hook = renderHook(() => useStaffSession());
    await waitFor(() => expect(hook.result.current.state).toBe('signedIn'));
    return hook;
  }

  it('sign-out tells the server and returns to the PIN screen', async () => {
    const { result } = await signedIn();
    fetchMock.mockResolvedValueOnce(json(204));
    await act(() => result.current.signOut());
    expect(result.current.state).toBe('signedOut');
    expect(fetchMock.mock.calls.at(-1)).toEqual(['/api/staff/logout', { method: 'POST' }]);
  });

  it('sign-out still returns to the PIN screen when the server cannot be told', async () => {
    const { result } = await signedIn();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.signOut());
    expect(result.current.state).toBe('signedOut');
  });

  it('a 401 from any staff request returns to the PIN screen', async () => {
    const { result } = await signedIn();
    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED' } }));
    await act(async () => {
      await staffFetch('/api/tables/5/bill');
    });
    expect(result.current.state).toBe('signedOut');
  });

  it('a request that is not refused leaves the session alone', async () => {
    const { result } = await signedIn();
    for (const status of [200, 404, 422, 500]) {
      fetchMock.mockResolvedValueOnce(json(status));
      await act(async () => {
        await staffFetch('/api/tables/5/close', { method: 'POST' });
      });
    }
    expect(result.current.state).toBe('signedIn');
  });

  it('stops listening after it unmounts', async () => {
    const { unmount } = await signedIn();
    unmount();
    expect(() => notifyStaffUnauthorized()).not.toThrow();
  });
});

describe('staffFetch', () => {
  it('regression: with no options it calls fetch with the address alone, not with an extra undefined', async () => {
    fetchMock.mockResolvedValue(json(200));
    await staffFetch('/api/tables/5/bill');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual(['/api/tables/5/bill']);
    expect(fetchMock.mock.calls[0]).toHaveLength(1);
  });

  it('passes the options through and returns the response as it is', async () => {
    const res = json(422, { error: { code: 'ILLEGAL_TRANSITION' } });
    fetchMock.mockResolvedValue(res);
    const init = { method: 'POST', body: '{}' };
    expect(await staffFetch('/api/x', init)).toBe(res);
    expect(fetchMock).toHaveBeenCalledWith('/api/x', init);
  });

  it('tells every listener about a 401, and a listener that stopped hears nothing', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const stopA = onStaffUnauthorized(a);
    onStaffUnauthorized(b);
    fetchMock.mockResolvedValue(json(401));
    await staffFetch('/api/x');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    stopA();
    await staffFetch('/api/x');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('lets a network failure through as the error it is (the caller shows its own message)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(staffFetch('/api/x')).rejects.toThrow('Failed to fetch');
  });
});
