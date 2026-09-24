import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "excali-theme";
const THEME_COLORS: Record<Theme, string> = {
    light: "#f7f7f8",
    dark: "#121212",
};

function getInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", THEME_COLORS[theme]);
    }, [theme]);

    // Follow OS changes until the user explicitly picks a theme.
    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (event: MediaQueryListEvent) => {
            if (localStorage.getItem(STORAGE_KEY)) return;
            setTheme(event.matches ? "dark" : "light");
        };
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    const toggleTheme = () => {
        setTheme((current) => {
            const next = current === "dark" ? "light" : "dark";
            localStorage.setItem(STORAGE_KEY, next);
            return next;
        });
    };

    return { theme, setTheme, toggleTheme };
}
