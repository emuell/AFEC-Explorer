
// Checks if we're running in tauro dev environment
export function isRunningInTauriDev() {
  return document.URL.startsWith('http://localhost')
}
