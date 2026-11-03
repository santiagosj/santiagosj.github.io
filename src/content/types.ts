export type Locale = "en" | "es";

export interface PostMeta {
    title: string;
    description: string;
    category: string;
    tags: string[];
    featured: boolean;
    date: string;
}

export interface Post {
    slug: string;
    locale: Locale;
    meta: PostMeta;
    body: string;
}

export interface ProjectMeta {
    title: string;
    description: string;
    category: string;
    team: string;
    tags: string[];
    featured: boolean;
    date: string;
    timeline: string;
    githubUrl?: string;
    liveUrl?: string;
}

export interface Project {
    slug: string;
    locale: Locale;
    meta: ProjectMeta;
    body: string;
}