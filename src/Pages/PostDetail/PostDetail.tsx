import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPost } from "../../content/posts";
import { useLanguage } from "../../Components/Language/LanguageContext";
import { TableOfContents, MarkdownContent } from "../../Components/Markdown/Markdown";

const PostDetail: React.FC = () => {
    const { postId } = useParams<{ postId: string }>();
    const { lang } = useLanguage();
    const contentRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);
    const [activeId, setActiveId] = useState<string>("");
    const [headingIds, setHeadingIds] = useState<string[]>([]);

    const post = getPost(postId || "", lang);

    const handleHeadingsMount = useCallback((ids: string[]) => {
        setActiveId("");
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
    }, [post]);

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
    }, [headingIds, post]);

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
            <div className="article-progress">
                <div className="article-progress-bar" style={{ width: `${progress}%` }} />
            </div>

            <div className="post-detail" ref={contentRef}>
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
                        {post.meta.tags.map((tag) => (
                            <span key={tag} className="tech-tag">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <MarkdownContent body={post.body} onHeadingsMount={handleHeadingsMount} />
            </div>

            <TableOfContents body={post.body} activeId={activeId} />
        </div>
    );
};

export default PostDetail;