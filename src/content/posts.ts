import { byDateDesc, flag, loadCollection, tagList, text, uniqueSorted } from "./collection";
import type { FrontmatterData } from "./collection";
import type { Post, PostMeta } from "./types";

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

export const posts: Post[] = loadCollection("posts", sources, toMeta)
    .sort((a, b) => byDateDesc(a.meta, b.meta));

export const postCategories: string[] = uniqueSorted(posts.map(post => post.meta.category));

export const getPost = (slug: string): Post | undefined =>
    posts.find(post => post.slug === slug);

export type { Post, PostMeta };