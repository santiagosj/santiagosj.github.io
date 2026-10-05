import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getProject } from "../../content/projects";
import { TableOfContents, MarkdownContent } from "../../Components/Markdown/Markdown";

const ProjectDetail: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const contentRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);
    const [activeId, setActiveId] = useState<string>("");
    const [headingIds, setHeadingIds] = useState<string[]>([]);

    const project = getProject(projectId || "");

    const handleHeadingsMount = useCallback((ids: string[]) => {
        setHeadingIds(ids);
    }, []);

    useEffect(() => {
        const container = contentRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const total = scrollHeight - clientHeight;
            const pct = total <= 0 ? 0 : Math.min((scrollTop / total) * 100, 100);
            setProgress(pct);
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => container.removeEventListener("scroll", handleScroll);
    }, [project]);

    useEffect(() => {
        if (headingIds.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => {
                        const ao = (a.target as HTMLElement).offsetTop;
                        const bo = (b.target as HTMLElement).offsetTop;
                        return ao - bo;
                    });

                if (visible.length > 0) {
                    setActiveId((visible[0].target as HTMLElement).id);
                    return;
                }

                const topMost = entries
                    .filter((entry) => entry.boundingClientRect.top <= 120)
                    .sort((a, b) => {
                        const ao = (a.target as HTMLElement).offsetTop;
                        const bo = (b.target as HTMLElement).offsetTop;
                        return bo - ao;
                    });

                if (topMost.length > 0) {
                    setActiveId((topMost[0].target as HTMLElement).id);
                }
            },
            {
                root: contentRef.current,
                rootMargin: "-20% 0% -60% 0%",
                threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
            },
        );

        headingIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [headingIds, project]);

    if (!project) {
        return (
            <div className="project-detail">
                <h2 className="ubuntu-bold">Project Not Found</h2>
                <p>The project you're looking for doesn't exist.</p>
                <Link to="/projects" className="back-link">← Back to Projects</Link>
            </div>
        );
    }

    return (
        <div className="article-shell">
            <div className="article-progress">
                <div className="article-progress-bar" style={{ width: `${progress}%` }} />
            </div>

            <div className="project-detail" ref={contentRef}>
                <Link to="/projects" className="back-link">← Back to Projects</Link>

                <div className="project-header">
                    <h1 className="ubuntu-bold">{project.meta.title}</h1>
                    <div className="project-meta">
                        <span className="project-category">{project.meta.category}</span>
                        <span className="project-team">{project.meta.team}</span>
                        {project.meta.featured && <span className="featured-badge">Featured</span>}
                        {project.meta.timeline && <span className="project-timeline">{project.meta.timeline}</span>}
                    </div>
                </div>

                <p className="project-lede">{project.meta.description}</p>

                {project.meta.tags.length > 0 && (
                    <div className="project-tags">
                        {project.meta.tags.map((tag) => (
                            <span key={tag} className="tech-tag">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <MarkdownContent body={project.body} onHeadingsMount={handleHeadingsMount} />

                {(project.meta.githubUrl || project.meta.liveUrl) && (
                    <div className="project-links">
                        {project.meta.githubUrl && (
                            <a
                                href={project.meta.githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="project-link"
                            >
                                View on GitHub →
                            </a>
                        )}
                        {project.meta.liveUrl && (
                            <a
                                href={project.meta.liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="project-link"
                            >
                                View Live Demo →
                            </a>
                        )}
                    </div>
                )}
            </div>

            <TableOfContents body={project.body} activeId={activeId} />
        </div>
    );
};

export default ProjectDetail;