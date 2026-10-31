// Follows the OS colour scheme by toggling shadcn's `dark` class on <html>.
export function followOsTheme() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", mq.matches);
  apply();
  mq.addEventListener("change", apply);
}
