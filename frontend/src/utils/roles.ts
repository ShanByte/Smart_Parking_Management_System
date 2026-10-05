import { Role } from '../types/contract';

/**
 * Returns the authoritative home route for each role:
 * USER -> '/' (map)
 * GUARD -> '/guard'
 * ADMIN -> '/admin'
 */
export function getRoleHomePath(role: Role): string {
  switch (role) {
    case 'GUARD':
      return '/guard';
    case 'ADMIN':
      return '/admin';
    case 'USER':
    default:
      return '/';
  }
}
