import React from "react";
import { Link } from "react-router-dom";
import { projects, projectTeams } from "../../content/projects";
import "./Projects.scss";

const Projects: React.FC = () => {
    const teams = ["All", ...projectTeams];
    const [selectedTeam, setSelectedTeam] = React.useState("All");

    const filteredProjects = selectedTeam === "All"
        ? projects
        : projects.filter(project => project.meta.team === selectedTeam);

    return (
        <div className="projects-content">

            <h2 className="ubuntu-bold">Projects</h2>
            <p className="ubuntu-regular">Red Team · Blue Team · Security Projects</p>

            <div className="category-filter">
                {teams.map(team => (
                    <button
                        key={team}
                        className={`category-btn ${selectedTeam === team ? 'active' : ''}`}
                        onClick={() => setSelectedTeam(team)}
                    >
                        {team}
                    </button>
                ))}
            </div>
            <div className="projects-grid">
                {filteredProjects.map(({ slug, meta }) => (
                    <div key={slug} className={`project-card ${meta.featured ? 'featured' : ''}`}>
                        {meta.featured && <div className="featured-badge">Featured</div>}

                        <div className="project-header">
                            <h3 className="ubuntu-medium">{meta.title}</h3>
                            <span className="project-category">{meta.team}</span>
                        </div>

                        <p className="project-description">{meta.description}</p>

                        <div className="project-technologies">
                            {meta.tags.map(tag => (
                                <span key={tag} className="tech-tag">{tag}</span>
                            ))}
                        </div>

                        <div className="project-actions">
                            <Link to={`/projects/${slug}`} className="view-details-btn">
                                Read
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Projects;