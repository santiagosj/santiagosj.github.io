import React from "react";
import { useLanguage } from "./LanguageContext";
import type { Locale } from "../../content/types";
import "./LangSwitch.scss";

const OPTIONS: Locale[] = ["en", "es"];

const LangSwitch: React.FC = () => {
    const { lang, setLang } = useLanguage();

    return (
        <div className="lang-switch" role="group" aria-label="Language">
            {OPTIONS.map(option => (
                <button
                    key={option}
                    type="button"
                    className={`lang-btn${lang === option ? " active" : ""}`}
                    aria-pressed={lang === option}
                    onClick={() => setLang(option)}
                >
                    {option.toUpperCase()}
                </button>
            ))}
        </div>
    );
};

export default LangSwitch;
