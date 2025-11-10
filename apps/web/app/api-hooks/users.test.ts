import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCurrentUser, useMyCharacters } from './users';
import { server } from '../../test/mocks/server';
import { http, HttpResponse } from 'msw';

/**
 * Example tests for user API hooks
 */

// Helper to wrap hooks with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useCurrentUser', () => {
  it('should fetch current user data', async () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data to load
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check data
    expect(result.current.data).toEqual({
      userId: 'test-user-1',
      role: 'USER',
      characterId: 12345,
      characterName: 'Test Character',
    });
  });

  it('should handle authentication errors', async () => {
    // Override handler to return 401
    server.use(
      http.get('http://localhost:3000/auth/me', () => {
        return new HttpResponse(null, { status: 401 });
      }),
    );

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useMyCharacters', () => {
  it('should fetch user characters', async () => {
    const { result } = renderHook(() => useMyCharacters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: 12345, name: 'Test Character', isPrimary: true },
    ]);
  });

  it('should return empty array when no characters', async () => {
    server.use(
      http.get('http://localhost:3000/users/me/characters', () => {
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useMyCharacters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

