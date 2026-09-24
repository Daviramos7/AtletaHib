import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ signOut: vi.fn(), onAuthStateChange: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ requireSupabase: () => ({ auth }) }));
import { onAuthStateChange, signOut } from './authService';

describe('global logout', () => {
  beforeEach(() => vi.resetAllMocks());
  it('explicitly requests global revocation using Supabase Auth', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await signOut();
    expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'global' });
  });
  it('does not claim global success or retry in a loop when offline', async () => {
    auth.signOut.mockResolvedValue({ error: new Error('network') });
    await expect(signOut()).rejects.toThrow('Você continua conectado');
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
  it('propagates the SDK signed-out state after logout or revoked refresh', () => {
    const callback = vi.fn(); const unsubscribe = vi.fn();
    auth.onAuthStateChange.mockImplementation((listener) => {
      listener('SIGNED_OUT', null); return { data: { subscription: { unsubscribe } } };
    });
    const dispose = onAuthStateChange(callback);
    expect(callback).toHaveBeenCalledWith(null); dispose(); expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
