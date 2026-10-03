import { byDateDesc, flag, loadCollection, optionalText, tagList, text, uniqueSorted } from "./collection";
import type { FrontmatterData } from "./collection";
import type { Project, ProjectMeta } from "./types";

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

export const projects: Project[] = loadCollection("projects", sources, toMeta)
    .sort((a, b) => byDateDesc(a.meta, b.meta));

export const projectTeams: string[] = uniqueSorted(projects.map(project => project.meta.team));

export const getProject = (slug: string): Project | undefined =>
    projects.find(project => project.slug === slug);

export type { Project, ProjectMeta };