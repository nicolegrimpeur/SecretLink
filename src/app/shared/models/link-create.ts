export interface LinkCreate {
  item_id: string;
  status: 'created' | 'duplicate_item_id' | 'invalid_item_id';
  link_token: string | null;
  link_url: string | null;
  expires_at: string | null;
  error: string | null;
}
