import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ActivateMembershipPage } from './ActivateMembershipPage';

const { functionInvokeMock, verifyOtpMock } = vi.hoisted(() => ({
  functionInvokeMock: vi.fn(),
  verifyOtpMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: verifyOtpMock,
    },
    functions: { invoke: functionInvokeMock },
  },
}));

const renderPage = () => render(
  <MemoryRouter>
    <ActivateMembershipPage />
  </MemoryRouter>,
);

describe('ActivateMembershipPage', () => {
  beforeEach(() => {
    functionInvokeMock.mockReset().mockResolvedValue({ data: {}, error: null });
    verifyOtpMock.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => cleanup());

  it('requests a code without revealing whether the roster email exists', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: ' Member@Example.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Email My Activation Code' }));

    await waitFor(() => expect(functionInvokeMock).toHaveBeenCalledWith(
      'request-member-access-code',
      { body: { email: 'member@example.com', intent: 'activation' } },
    ));
    expect(await screen.findByText(/If that email belongs/)).toBeInTheDocument();
    expect(screen.getByLabelText('Six-digit code')).toBeInTheDocument();
  });

  it('verifies the emailed code and offers password or passwordless sign in', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'member@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Email My Activation Code' }));

    const codeInput = await screen.findByLabelText('Six-digit code');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify My Code' }));

    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalledWith({
      email: 'member@example.com',
      token: '123456',
      type: 'email',
    }));
    expect(functionInvokeMock).toHaveBeenCalledWith('complete-member-activation', { body: {} });
    expect(await screen.findByRole('button', { name: 'Save My Password' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip Password — Use Email Codes' })).toHaveAttribute('href', '/my-lodge');
  });

  it('saves an optional password after activation', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'member@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Email My Activation Code' }));
    fireEvent.change(await screen.findByLabelText('Six-digit code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify My Code' }));

    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'a-secure-password' },
    });
    fireEvent.change(screen.getByLabelText('Type it again'), {
      target: { value: 'a-secure-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save My Password' }));

    await waitFor(() => expect(functionInvokeMock).toHaveBeenCalledWith(
      'change-required-password',
      { body: { password: 'a-secure-password' } },
    ));
    expect(await screen.findByText('Your membership is active')).toBeInTheDocument();
  });
});
