import { byDateDesc, flag, loadCollection, localize, optionalText, tagList, text, uniqueSorted } from "./collection";
import type { FrontmatterData } from "./collection";
import type { Locale, Project, ProjectMeta } from "./types";

const sources = import.meta.glob("./projects/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

const toMeta = (data: FrontmatterData): ProjectMeta => ({
    title: text(data.title) || "Untitled",
    description: text(data.description),
    category: text(data.category) || "Uncategorized",
    team: text(data.team) || "Unassigned",
    tags: tagList(data.tags),
    featured: flag(data.featured),
    date: text(data.date),
    timeline: text(data.timeline),
    githubUrl: optionalText(data.githubUrl),
    liveUrl: optionalText(data.liveUrl),
});

const all: Project[] = loadCollection("projects", sources, toMeta);

export const getProjects = (lang: Locale): Project[] =>
    localize(all, lang).sort((a, b) => byDateDesc(a.meta, b.meta));

export const getProjectTeams = (lang: Locale): string[] =>
    uniqueSorted(getProjects(lang).map(project => project.meta.team));

export const getProject = (slug: string, lang: Locale): Project | undefined =>
    localize(all, lang).find(project => project.slug === slug);

export const teamClass = (team: string): string =>
    team === "Red Team" ? "team-red" : team === "Blue Team" ? "team-blue" : "";

export type { Locale, Project, ProjectMeta };
