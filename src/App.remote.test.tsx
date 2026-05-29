import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAppData } from './data/defaultData';
import App from './App';
import { saveAppData } from './storage/appStorage';

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
    window.localStorage.clear();
    mocks.client.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('lets signed-out users choose local mode or account sync', async () => {
    const user = userEvent.setup();
    mocks.client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'เริ่มจัดการเงินของคุณ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ใช้บนเครื่องนี้' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบเพื่อ sync' })).toBeInTheDocument();
    expect(screen.queryByText(/Row Level Security/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ใช้บนเครื่องนี้' }));

    expect(screen.getByRole('heading', { name: 'ภาพรวมเงินสด' })).toBeInTheDocument();
  });

  it('shows account sync errors and notices with accessible status roles', async () => {
    const user = userEvent.setup();
    mocks.client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.client.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    mocks.client.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'เข้าสู่ระบบเพื่อ sync' }));
    await user.type(screen.getByLabelText('อีเมล'), 'demo@example.com');
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'wrong-password');
    const signInButtons = screen.getAllByRole('button', { name: 'เข้าสู่ระบบ' });
    await user.click(signInButtons[signInButtons.length - 1]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');

    await user.click(screen.getByRole('button', { name: 'สมัครบัญชี' }));
    await user.click(screen.getByRole('button', { name: 'สร้างบัญชี' }));

    expect(await screen.findByRole('status')).toHaveTextContent('สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
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

    await user.click(screen.getByRole('button', { name: 'ตั้งค่า' }));

    expect(screen.getByRole('heading', { name: 'บัญชี Supabase' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'ออกจากระบบ' }).length).toBeGreaterThan(0);
  });

  it('keeps the locally selected payday day when remote data loads', async () => {
    const session = {
      user: { id: 'user-1', email: 'demo@example.com' },
    };
    saveAppData({
      ...defaultAppData,
      settings: {
        ...defaultAppData.settings,
        paydayDay: 25,
      },
    });
    mocks.client.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mocks.loadRemoteAppData.mockResolvedValue(defaultAppData);

    render(<App />);

    expect(await screen.findByText('demo@example.com')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'วันเงินเดือนออก' })).toHaveValue('25');
    expect(screen.getByText('รอบเงินเดือน 25 พ.ค. - 24 มิ.ย.')).toBeInTheDocument();
  });
});
