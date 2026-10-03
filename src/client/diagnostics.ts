// Opt-in development instrumentation. No player state is read or logged.
let readyReported = Boolean(import.meta.hot?.data.readyReported);
export function reportReady() {
  if (!import.meta.env.DEV || !new URLSearchParams(location.search).has('perf') || readyReported)
    return;
  readyReported = true;
  if (import.meta.hot) import.meta.hot.data.readyReported = true;
  console.info('TankStorm ready', JSON.stringify({ readyMs: performance.now() }));
  probeFrames('base');
}
export function reportBattleFrames() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('perf'))
    probeFrames('battle');
}
function probeFrames(scene: string) {
  const intervals: number[] = [];
  let previous: number | undefined;
  const started = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    const sorted = [...intervals].sort((a, b) => a - b);
    console.info(
      'TankStorm frame probe',
      JSON.stringify({
        scene,
        samples: intervals.length,
        elapsedMs: performance.now() - started,
        meanFps: intervals.length
          ? 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length)
          : null,
        p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? null,
        maxFrameMs: sorted.at(-1) ?? null,
        visibility: document.visibilityState,
      }),
    );
  };
  const frame = (now: number) => {
    if (done) return;
    if (previous !== undefined) intervals.push(now - previous);
    previous = now;
    if (intervals.length >= 240) finish();
    else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  setTimeout(finish, 10000);
}
