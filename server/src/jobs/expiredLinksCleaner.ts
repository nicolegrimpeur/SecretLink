import { getLogger } from '../shared/logger.js';
import { linkStore } from '../modules/links/link.store.js';

const logger = getLogger('ExpiredLinksCleaner');

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function startExpiredLinksCleaner(): void {
  const run = async () => {
    try {
      const { ciphertextPurged, locksReleased } = await linkStore.purgeAllExpiredLinks();
      if (ciphertextPurged > 0 || locksReleased > 0) {
        logger.info(
          { ciphertextPurged, locksReleased },
          'Expired links cleanup completed',
        );
      }
    } catch (err) {
      logger.error(err, 'Expired links cleanup failed');
    }
  };

  run();
  setInterval(run, INTERVAL_MS);
}
