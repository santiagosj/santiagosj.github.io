import React from "react";
import { useParams, Link } from "react-router-dom";
import { getPost } from "../../content/posts";
import Markdown, { TableOfContents } from "../../Components/Markdown/Markdown";

const PostDetail: React.FC = () => {
    const { postId } = useParams<{ postId: string }>();

    const post = getPost(postId || "");

    if (!post) {
        return (
            <div className="post-detail">
                <h2 className="ubuntu-bold">Post Not Found</h2>
                <p>The post you're looking for doesn't exist.</p>
                <Link to="/posts" className="back-link">← Back to Posts</Link>
            </div>
        );
    }

    return (
        <div className="article-shell">
            <div className="post-detail">
                <Link to="/posts" className="back-link">← Back to Posts</Link>

                <div className="post-header">
                    <h1 className="ubuntu-bold">{post.meta.title}</h1>
                    <div className="post-meta">
                        <span className="post-category">{post.meta.category}</span>
                        {post.meta.featured && <span className="featured-badge">Featured</span>}
                        {post.meta.date && <span className="post-date">{post.meta.date}</span>}
                    </div>
                </div>

                <p className="post-lede">{post.meta.description}</p>

                {post.meta.tags.length > 0 && (
                    <div className="post-tags">
                        {post.meta.tags.map(tag => (
                            <span key={tag} className="tech-tag">{tag}</span>
                        ))}
                    </div>
                )}

                <Markdown body={post.body} />
            </div>

            <TableOfContents body={post.body} />
        </div>
    );
};

export default PostDetail;