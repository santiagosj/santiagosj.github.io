import React from "react";
import { Link } from "react-router-dom";
import { getProjectTeams, getProjects, teamClass } from "../../content/projects";
import { useLanguage } from "../../Components/Language/LanguageContext";
import LangSwitch from "../../Components/Language/LangSwitch";
import "./Projects.scss";

const ALL = "All";

const Projects: React.FC = () => {
    const { lang } = useLanguage();
    const teams = [ALL, ...getProjectTeams(lang)];
    const [selectedTeam, setSelectedTeam] = React.useState(ALL);

    const activeTeam = teams.includes(selectedTeam) ? selectedTeam : ALL;
    const projects = getProjects(lang);

    const filteredProjects = activeTeam === ALL
        ? projects
        : projects.filter(project => project.meta.team === activeTeam);

    return (
        <div className="projects-content">

            <h2 className="ubuntu-bold">Projects</h2>
            <p className="ubuntu-regular">Red Team · Blue Team · Purple Team · Security Projects</p>

            <div className="category-filter">
                {teams.map(team => (
                    <button
                        key={team}
                        className={`category-btn ${activeTeam === team ? 'active' : ''}`}
                        onClick={() => setSelectedTeam(team)}
                    >
                        {team}
                    </button>
                ))}
                <LangSwitch />
            </div>
            <div className="projects-grid">
                {filteredProjects.map(({ slug, meta }) => (
                    <div key={slug} className={`project-card ${meta.featured ? 'featured' : ''}`}>
                        {meta.featured && <div className="featured-badge">Featured</div>}

                        <div className="project-header">
                            <h3 className="ubuntu-medium">{meta.title}</h3>
                            <span className={`project-category ${teamClass(meta.team)}`}>{meta.team}</span>
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
