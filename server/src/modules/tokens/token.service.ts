import { tokenStore } from './token.store.js';
import { generateLinkToken, hashToken } from '../../shared/crypto.js';

export class TokenService {
  async createToken(
    userId: number,
    label: string | null,
    scopes: string[],
  ): Promise<{
    token: string;
    token_preview: string;
    pat: {
      id: number;
      label: string | null;
      scopes: string[];
      created_at: string;
      revoked_at: null;
    };
  }> {
    // Generate a new random token
    const token = generateLinkToken();
    const tokenHash = hashToken(token);

    // Scopes should be a comma-separated string in the DB
    const scopesStr = scopes.join(',');

    // Insert into database
    const result = await tokenStore.createToken(userId, tokenHash, label, scopesStr);

    return {
      token,
      token_preview: token.slice(-6),
      pat: {
        id: result.insertId,
        label: label,
        scopes,
        created_at: new Date().toISOString(),
        revoked_at: null,
      },
    };
  }

  async listTokens(userId: number): Promise<any[]> {
    const tokens = await tokenStore.listByUserId(userId);
    return tokens.map((t) => ({
      id: t.id,
      label: t.label,
      scopes: t.scopes.split(',').filter(Boolean),
      created_at: t.created_at,
      revoked_at: t.revoked_at,
    }));
  }

  async revokeToken(userId: number, tokenId: number): Promise<void> {
    await tokenStore.revokeToken(userId, tokenId);
  }
}

export const tokenService = new TokenService();
