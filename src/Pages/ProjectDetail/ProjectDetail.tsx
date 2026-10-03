import React from "react";
import { useParams, Link } from "react-router-dom";
import { getProject } from "../../content/projects";
import Markdown, { TableOfContents } from "../../Components/Markdown/Markdown";

const ProjectDetail: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();

    const project = getProject(projectId || "");

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
            <div className="project-detail">
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
                        {project.meta.tags.map(tag => (
                            <span key={tag} className="tech-tag">{tag}</span>
                        ))}
                    </div>
                )}

                <Markdown body={project.body} />

                {(project.meta.githubUrl || project.meta.liveUrl) && (
                    <div className="project-links">
                        {project.meta.githubUrl && (
                            <a href={project.meta.githubUrl} target="_blank" rel="noopener noreferrer" className="project-link">
                                View on GitHub →
                            </a>
                        )}
                        {project.meta.liveUrl && (
                            <a href={project.meta.liveUrl} target="_blank" rel="noopener noreferrer" className="project-link">
                                View Live Demo →
                            </a>
                        )}
                    </div>
                )}
            </div>

            <TableOfContents body={project.body} />
        </div>
    );
};

export default ProjectDetail;