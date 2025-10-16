import {Error} from "./error";

export type RedeemResponse =
  | { secret: string; item_id?: string; expires_at?: string } // succès
  | Error;            // erreur (si le back renvoie JSON)
