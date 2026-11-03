import { parseFrontmatter } from "./frontmatter";
import type { FrontmatterValue } from "./frontmatter";
import type { Locale } from "./types";

export type FrontmatterData = Record<string, FrontmatterValue>;

export const text = (value: FrontmatterValue | undefined): string =>
    typeof value === "string" ? value : "";

export const optionalText = (value: FrontmatterValue | undefined): string | undefined =>
    text(value) || undefined;

export const flag = (value: FrontmatterValue | undefined): boolean =>
    value === true || value === "true";

export const tagList = (value: FrontmatterValue | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        return value
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean);
    }
    return [];
};

export interface Entry<T> {
    slug: string;
    locale: Locale;
    meta: T;
    body: string;
}

const ES_SUFFIX = ".es";

export const loadCollection = <T>(
    dir: string,
    sources: Record<string, string>,
    toMeta: (data: FrontmatterData) => T,
): Entry<T>[] =>
    Object.entries(sources).map(([path, raw]): Entry<T> => {
        const { data, content } = parseFrontmatter(raw);
        const file = path.replace(`./${dir}/`, "").replace(/\.md$/, "");
        const localized = file.endsWith(ES_SUFFIX);

        return {
            slug: localized ? file.slice(0, -ES_SUFFIX.length) : file,
            locale: localized ? "es" : "en",
            meta: toMeta(data),
            body: content,
        };
    });

export const localize = <T>(entries: Entry<T>[], lang: Locale): Entry<T>[] => {
    const translated = entries.filter(entry => entry.locale === lang);
    if (lang === "en") return translated;

    const present = new Set(translated.map(entry => entry.slug));
    return [
        ...translated,
        ...entries.filter(entry => entry.locale === "en" && !present.has(entry.slug)),
    ];
};

export const byDateDesc = <T extends { date: string }>(a: T, b: T): number =>
    b.date.localeCompare(a.date);

export const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();