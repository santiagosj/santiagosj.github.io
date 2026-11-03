import { createContext, useContext } from "react";
import type { Locale } from "../../content/types";

export const STORAGE_KEY = "portfolio-lang";

export const detect = (): Locale => {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "en" || stored === "es") return stored;
    } catch {
        // storage unavailable — fall back to browser language
    }

    return window.navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
};

export interface LanguageValue {
    lang: Locale;
    setLang: (lang: Locale) => void;
}

export const LanguageContext = createContext<LanguageValue | null>(null);

export const useLanguage = (): LanguageValue => {
    const context = useContext(LanguageContext);

    if (!context) throw new Error("useLanguage must be used within a LanguageProvider");

    return context;
};
