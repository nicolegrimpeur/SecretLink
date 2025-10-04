export interface LinkStatus {
  item_id: string;
  link_token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  deleted_at: string | null;
}
