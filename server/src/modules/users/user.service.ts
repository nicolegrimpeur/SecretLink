import argon2 from 'argon2';
import { userStore } from './user.store.js';
import { withTx } from '../../config/database.js';
import { ValidationError, UnauthorizedError, NotFoundError } from '../../shared/types.js';

interface PublicUser {
  id: number;
  email: string;
  created_at: string;
  email_verified_at: string | null;
}

function publicUser(row: any): PublicUser {
  return {
    id: Number(row.id),
    email: row.email,
    created_at: row.created_at,
    email_verified_at: row.email_verified_at ?? null,
  };
}

export class UserService {
  async signup(email: string, password: string): Promise<PublicUser> {
    if (!email || !password) {
      throw new ValidationError('Email and password required');
    }

    const existing = await userStore.findByEmail(email);
    if (existing) {
      throw new ValidationError('Email already in use');
    }

    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const result = await userStore.createUser(email, Buffer.from(hash));

    const user = await userStore.getById(result.insertId);
    if (!user) {
      throw new Error('User creation failed');
    }

    return publicUser(user);
  }

  async login(email: string, password: string): Promise<PublicUser> {
    if (!email || !password) {
      throw new ValidationError('Email and password required');
    }

    const user = await userStore.findByEmail(email);
    if (!user || !user.password_hash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const ok = await argon2.verify(user.password_hash.toString(), password);
    if (!ok) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return publicUser(user);
  }

  async getById(id: number): Promise<PublicUser> {
    const user = await userStore.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return publicUser(user);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userStore.getById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.password_hash) {
      throw new ValidationError('No password set');
    }

    const ok = await argon2.verify(user.password_hash.toString(), currentPassword);
    if (!ok) {
      throw new UnauthorizedError('Invalid current password');
    }

    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await userStore.updatePassword(userId, Buffer.from(hash));
  }

  async purgeUserData(userId: number): Promise<void> {
    // Purge revoked tokens and expired links
    await userStore.purgeUserApiTokens(userId);
    await userStore.purgeUserLinks(userId);
  }

  async deleteUser(userId: number): Promise<void> {
    // Delete user and all associated data in a transaction
    await withTx(async (cx) => {
      await userStore.deleteUserLinks(cx, userId);
      await userStore.deleteUserApiTokens(cx, userId);
      await userStore.deleteUserItems(cx, userId);
      await userStore.deleteUser(cx, userId);
    });
  }
}

export const userService = new UserService();
