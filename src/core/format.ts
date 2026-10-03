// Display only: truncate to two decimals, never overstate an available balance.
// Calculations, saves, inputs and exact-detail views retain the original integer.
export function compactAmount(value: number): string {
  if (!Number.isSafeInteger(value)) throw Error('资源数量须为安全整数');
  const magnitude = Math.abs(value),
    suffix = ['', 'K', 'M', 'G', 'T'];
  let index = 0,
    divisor = 1;
  while (index < suffix.length - 1 && magnitude >= divisor * 1000) {
    index++;
    divisor *= 1000;
  }
  const whole = Math.floor(magnitude / divisor);
  const decimals = String(Math.floor(((magnitude % divisor) * 100) / divisor))
    .padStart(2, '0')
    .replace(/0+$/, '');
  return (value < 0 ? '-' : '') + whole + (decimals ? '.' + decimals : '') + suffix[index];
}
