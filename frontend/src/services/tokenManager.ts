/**
 * In-Memory Token Manager
 * Strictly complies with Rule 6 & C5:
 * "Access tokens must remain in memory only. Do not persist JWT access tokens in localStorage or sessionStorage."
 */

let inMemoryAccessToken: string | null = null;

export const tokenManager = {
  getAccessToken(): string | null {
    return inMemoryAccessToken;
  },

  setAccessToken(token: string | null): void {
    inMemoryAccessToken = token;
  },

  clear(): void {
    inMemoryAccessToken = null;
  },
};
