import React from "react";
import { Link } from "react-router-dom";
import { getPostCategories, getPosts } from "../../content/posts";
import { useLanguage } from "../../Components/Language/LanguageContext";
import LangSwitch from "../../Components/Language/LangSwitch";
import "./Posts.scss";

const ALL = "All";

const Posts: React.FC = () => {
    const { lang } = useLanguage();
    const categories = [ALL, ...getPostCategories(lang)];
    const [selectedCategory, setSelectedCategory] = React.useState(ALL);

    const activeCategory = categories.includes(selectedCategory) ? selectedCategory : ALL;
    const posts = getPosts(lang);

    const filteredPosts = activeCategory === ALL
        ? posts
        : posts.filter(post => post.meta.category === activeCategory);

    return (
        <div className="posts-content">

            <h2 className="ubuntu-bold">Posts</h2>
            <p className="ubuntu-regular">Attack surface reasoning, vector definition &amp; applied projects</p>

            <div className="category-filter">
                {categories.map(category => (
                    <button
                        key={category}
                        className={`category-btn ${activeCategory === category ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(category)}
                    >
                        {category}
                    </button>
                ))}
                <LangSwitch />
            </div>
            <div className="posts-grid">
                {filteredPosts.map(({ slug, meta }) => (
                    <div key={slug} className={`post-card ${meta.featured ? 'featured' : ''}`}>
                        {meta.featured && <div className="featured-badge">Featured</div>}

                        <div className="post-header">
                            <h3 className="ubuntu-medium">{meta.title}</h3>
                            <span className="post-category">{meta.category}</span>
                        </div>

                        <p className="post-description">{meta.description}</p>

                        <div className="post-technologies">
                            {meta.tags.map(tag => (
                                <span key={tag} className="tech-tag">{tag}</span>
                            ))}
                        </div>

                        <div className="post-actions">
                            <Link to={`/posts/${slug}`} className="view-details-btn">
                                Read
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Posts;
