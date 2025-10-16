export type PAT = {
  id: number;
  label: string | null;
  scopes: ('links:read' | 'links:write' | 'links:delete')[];
  created_at: string;
  revoked_at: string | null;
} | null;
