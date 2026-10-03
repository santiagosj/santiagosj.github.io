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
    meta: ProjectMeta;
    body: string;
}