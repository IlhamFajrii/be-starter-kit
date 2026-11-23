import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Endpoint tanpa token. Semua endpoint lain wajib login secara default. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Batasi endpoint ke peran tertentu. Tanpa dekorator ini, semua peran boleh. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  userId: number;
  role: Role;
}
