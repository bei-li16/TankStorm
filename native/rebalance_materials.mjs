// Reproducible v0.28 recipes: v0.26 -> v0.27 allocation -> +50% Ti; reruns never compound.
import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../design/classic-prototype-rules.json', import.meta.url);
const rules = JSON.parse(readFileSync(path, 'utf8'));
const keys = ['iron', 'oil', 'lead', 'titanium'];
const rates = rules.economy.baseRatePerHour;
const ratios = {
  tank: [100, 56, 52],
  tank_destroyer: [54, 100, 58],
  spg: [58, 52, 100],
  rocket: [100, 96, 92, 88],
};
const legacyTank = [
  [24, 15, 10, 0],
  [120, 72, 48, 0],
  [480, 288, 192, 39],
  [1500, 900, 600, 180],
  [3600, 2160, 1440, 576],
  [7200, 4320, 2880, 1440],
  [12000, 7200, 4800, 3000],
];
const light = {
  tank: [24, 15, 10, 0],
  tank_destroyer: [22, 14, 9, 0],
  spg: [27, 17, 11, 0],
  rocket: [29, 18, 12, 0],
};
const hours = (cost) => keys.reduce((sum, key, i) => sum + cost[i] / rates[key], 0);
for (const u of rules.units) {
  const legacy =
    u.tier === 1
      ? light[u.classId]
      : legacyTank[u.tier - 1].map((n) =>
          Math.ceil(n * { tank: 1, tank_destroyer: 0.9, spg: 1.1, rocket: 1.2 }[u.classId]),
        );
  const weights = [...ratios[u.classId]];
  if (weights.length === 3) weights.push(weights.reduce((a, b) => a + b, 0) / 3);
  if (u.tier === 1) weights[3] = 0; // HQ6 titanium unlock; no new-player resource deadlock.
  let scalar = hours(legacy) / hours(weights);
  // Starter oil/lead gather more slowly than iron. Keep the new dominant input
  // within the established 2.5-production-cycle funding ceiling at level one.
  if (u.tier === 1)
    scalar = Math.min(
      scalar,
      ...weights.slice(0, 3).map((w, i) => (u.productionSeconds * 2.5 * rates[keys[i]]) / 3600 / w),
    );
  const values = weights.map((n) =>
    u.tier === 1 ? Math.floor(n * scalar) : Math.round(n * scalar),
  );
  if (u.classId === 'rocket') {
    for (let i = 1; i < (u.tier === 1 ? 3 : 4); i++)
      values[i] = Math.min(values[i], values[i - 1] - 1);
  } else if (u.tier > 1) values[3] = Math.round((values[0] + values[1] + values[2]) / 3);
  const repairCrystal = Math.ceil(0.4 * rates.crystal * hours(values));
  values[3] = Math.ceil(values[3] * 1.5); // v28: explicit +50% Ti; other inputs and repair crystal unchanged.
  u.cost = { ...Object.fromEntries(keys.map((r, i) => [r, values[i]])), crystal: 0 };
  u.repairCost = { crystal: repairCrystal };
}
rules.economy.balanceVersion = 'economy-v0.28';
rules.economy.vehicleMaterialPolicy = {
  ratios,
  titanium: 'v28: ceil(v27 titanium * 1.5), including rocket; no budget renormalization',
  lightTier: 'no titanium until HQ6; tiers II–VII use all four resources',
  budget:
    'v27 preserves v26 sum(cost/base_hourly_rate); v28 adds 50% Ti without renormalization; repair crystal stays at v27 budget; light tier capped at 2.5 production cycles',
  research:
    'Lv1–5 iron/oil/lead/crystal; Lv6–120 all five, v27 collection-hour budget redistributed, v28 titanium multiplied by 1.5',
};
writeFileSync(path, JSON.stringify(rules, null, 2) + '\n');
console.log(
  'Updated 28 recipes and linked repair crystal costs; booked orders keep stored unitCost.',
);
