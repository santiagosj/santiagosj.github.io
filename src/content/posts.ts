import { byDateDesc, flag, loadCollection, localize, tagList, text, uniqueSorted } from "./collection";
import type { FrontmatterData } from "./collection";
import type { Locale, Post, PostMeta } from "./types";

const sources = import.meta.glob("./posts/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

const toMeta = (data: FrontmatterData): PostMeta => ({
    title: text(data.title) || "Untitled",
    description: text(data.description),
    category: text(data.category) || "Uncategorized",
    tags: tagList(data.tags),
    featured: flag(data.featured),
    date: text(data.date),
});

const all: Post[] = loadCollection("posts", sources, toMeta);

export const getPosts = (lang: Locale): Post[] =>
    localize(all, lang).sort((a, b) => byDateDesc(a.meta, b.meta));

export const getPostCategories = (lang: Locale): string[] =>
    uniqueSorted(getPosts(lang).map(post => post.meta.category));

export const getPost = (slug: string, lang: Locale): Post | undefined =>
    localize(all, lang).find(post => post.slug === slug);

export type { Locale, Post, PostMeta };
