import { tokenStore } from './token.store.js';
import { generateLinkToken, hashToken } from '../../shared/crypto.js';
import { NotFoundError } from '../../shared/types.js';

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

    // Scopes are stored as a JSON array in the DB
    const scopesStr = JSON.stringify(scopes);

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
      scopes: Array.isArray(t.scopes) ? t.scopes : JSON.parse(t.scopes),
      created_at: t.created_at,
      revoked_at: t.revoked_at,
    }));
  }

  async revokeToken(userId: number, tokenId: number): Promise<void> {
    const affectedRows = await tokenStore.revokeToken(userId, tokenId);
    if (affectedRows === 0) {
      throw new NotFoundError('Token not found');
    }
  }
}

export const tokenService = new TokenService();
