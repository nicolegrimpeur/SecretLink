export type LinkCreateSingleItem = { secret: string };
export type LinkCreateItem = { item_id: string; secret: string; ttl_days?: number };

export interface LinkCreateResult {
  item_id: string;
  status: 'created' | 'duplicate_item_id' | 'invalid_item_id';
  link_token: string | null;
  link_url: string | null;
  expires_at: string | null;
  error: string | null;
}
