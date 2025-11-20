import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession() {
    return {
      data: {
        user: { name: 'Test User', email: 'test@example.com' },
        accessToken: 'test-token',
      },
      status: 'authenticated',
    };
  },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

