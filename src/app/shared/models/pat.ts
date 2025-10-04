export interface Pat {
  id: number;
  label: string;
  scopes: ('links:read' | 'links:write' | 'links:delete')[];
  created_at: string;
  revoked_at: string | null;
}

export interface NewPat {
  token: string;
  token_preview: string;
  pat: Pat;
}
