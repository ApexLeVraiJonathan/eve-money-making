import { http, HttpResponse } from 'msw';

/**
 * MSW request handlers for mocking API responses in tests
 * 
 * Usage:
 * ```ts
 * import { server } from './mocks/server';
 * server.use(http.get('/auth/me', () => HttpResponse.json({ userId: '123' })));
 * ```
 */

const API_URL = 'http://localhost:3000'; // API is on port 3000

export const handlers = [
  // Auth endpoints
  http.get(`${API_URL}/auth/me`, () => {
    return HttpResponse.json({
      userId: 'test-user-1',
      role: 'USER',
      characterId: 12345,
      characterName: 'Test Character',
    });
  }),

  // Users endpoints
  http.get(`${API_URL}/users/me/characters`, () => {
    return HttpResponse.json([
      { id: 12345, name: 'Test Character', isPrimary: true },
    ]);
  }),

  // Cycles endpoints
  http.get(`${API_URL}/cycles`, () => {
    return HttpResponse.json([
      {
        id: 'cycle-1',
        name: 'Test Cycle',
        status: 'OPEN',
        openedAt: new Date().toISOString(),
      },
    ]);
  }),

  // Add more handlers as needed...
];

