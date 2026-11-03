import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageContext, detect, STORAGE_KEY } from "./LanguageContext";
import type { Locale } from "../../content/types";

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lang, setLangState] = useState<Locale>(detect);

    useEffect(() => {
        document.documentElement.lang = lang;

        try {
            window.localStorage.setItem(STORAGE_KEY, lang);
        } catch {
            // storage unavailable — language still applies for this session
        }
    }, [lang]);

    const setLang = useCallback((next: Locale) => setLangState(next), []);
    const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
