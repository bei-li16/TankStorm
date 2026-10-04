import { MAX_LEVEL } from './growth';

// Protected stock is a fraction of capacity, not a fraction of the current wallet.
// Spending it is allowed; looting it is not. Gold and items are outside this ledger.
export function protectionBps(warehouseLevel: number) {
  return (
    2000 +
    Math.floor((2000 * (Math.max(1, Math.min(MAX_LEVEL, warehouseLevel)) - 1)) / (MAX_LEVEL - 1))
  );
}
export function protectionLedger(held: number, capacity: number, level: number) {
  const bps = protectionBps(level);
  const limit = Math.floor((capacity * bps) / 10000);
  const protectedStock = Math.min(held, limit);
  return { bps, limit, protectedStock, lootable: Math.max(0, held - limit) };
}
