// Integer hours keep the input unambiguous and bound one synchronous settlement.
export const MAX_REST_HOURS = 720;
export function validateRestMinutes(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 60 || minutes > MAX_REST_HOURS * 60 || minutes % 60)
    throw Error(`请输入 1—${MAX_REST_HOURS} 的整数小时`);
}
