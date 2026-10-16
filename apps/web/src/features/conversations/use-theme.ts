import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("alloo-theme") ?? "system");
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (system.matches ? "dark" : "light") : theme;
    };
    apply();
    localStorage.setItem("alloo-theme", theme);
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  return [theme, setTheme] as const;
}
