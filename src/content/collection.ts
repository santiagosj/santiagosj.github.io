import { parseFrontmatter } from "./frontmatter";
import type { FrontmatterValue } from "./frontmatter";

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
    meta: T;
    body: string;
}

export const loadCollection = <T>(
    dir: string,
    sources: Record<string, string>,
    toMeta: (data: FrontmatterData) => T,
): Entry<T>[] =>
    Object.entries(sources).map(([path, raw]) => {
        const { data, content } = parseFrontmatter(raw);

        return {
            slug: path.replace(`./${dir}/`, "").replace(/\.md$/, ""),
            meta: toMeta(data),
            body: content,
        };
    });

export const byDateDesc = <T extends { date: string }>(a: T, b: T): number =>
    b.date.localeCompare(a.date);

export const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();