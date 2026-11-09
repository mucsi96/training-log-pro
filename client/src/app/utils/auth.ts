// Returns a promise that never resolves. Use it to freeze an async flow
// after assigning window.location.href so no further code runs before the
// browser navigates away.
export function haltForNavigation(): Promise<never> {
  return new Promise<never>(() => {});
}
