import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAppData } from './data/defaultData';
import App from './App';

const mocks = vi.hoisted(() => ({
  client: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    },
  },
  loadRemoteAppData: vi.fn(),
}));

vi.mock('./storage/supabaseClient', () => ({
  getSupabaseClient: () => mocks.client,
  isSupabaseConfigured: () => true,
}));

vi.mock('./storage/supabaseStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./storage/supabaseStorage')>()),
  loadRemoteAppData: mocks.loadRemoteAppData,
}));

describe('App Supabase flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('shows a login screen when Supabase is configured and no session exists', async () => {
    mocks.client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบเพื่อเก็บข้อมูลถาวร' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('loads remote data when a Supabase session exists', async () => {
    const user = userEvent.setup();
    const session = {
      user: { id: 'user-1', email: 'demo@example.com' },
    };
    mocks.client.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mocks.loadRemoteAppData.mockResolvedValue({
      ...defaultAppData,
      transactions: [
        {
          id: 'tx-cloud',
          type: 'expense',
          categoryId: 'food',
          amount: 120,
          date: '2026-05-12',
          note: 'cloud sync',
          createdAt: '2026-05-12T02:00:00.000Z',
          updatedAt: '2026-05-12T02:00:00.000Z',
        },
      ],
    });

    render(<App />);

    expect(await screen.findByText('demo@example.com')).toBeInTheDocument();
    expect(mocks.loadRemoteAppData).toHaveBeenCalledWith(mocks.client, 'user-1');

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('heading', { name: 'Supabase account' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'ออกจากระบบ' }).length).toBeGreaterThan(0);
  });
});
