import React from "react";
import { Marked } from "marked";
import type { Tokens, TokensList } from "marked";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import http from "highlight.js/lib/languages/http";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import powershell from "highlight.js/lib/languages/powershell";
import typescript from "highlight.js/lib/languages/typescript";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import plaintext from "highlight.js/lib/languages/plaintext";

import "./Markdown.scss";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("http", http);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("powershell", powershell);
hljs.registerAliases(["ps1", "pwsh"], { languageName: "powershell" });
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerAliases(["text", "txt"], { languageName: "plaintext" });

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/<[^>]*>/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const renderer = new Marked({
    gfm: true,
    renderer: {
        heading({ tokens, depth }) {
            const inner = this.parser.parseInline(tokens);
            const id = slugify(inner);
            const marker = "#".repeat(depth);
            return `<h${depth} id="${id}"><span class="md-marker">${marker}</span>${inner}</h${depth}>`;
        },
        blockquote({ tokens }) {
            let inner = this.parser.parse(tokens);
            let label = "";
            const labelled = inner.match(/^<p>\s*<strong>([\s\S]*?)<\/strong>\s*/);

            if (labelled) {
                label = labelled[1].replace(/<[^>]*>/g, "");
                inner = inner.replace(labelled[0], "<p>");
            }

            const tag = label ? `<span class="md-quote-label">${label}</span>` : "";
            return `<blockquote>${tag}${inner}</blockquote>`;
        },
        code({ text, lang }) {
            const requested = (lang ?? "").trim().split(/\s+/)[0].toLowerCase();
            const language = requested && hljs.getLanguage(requested) ? requested : "plaintext";
            const highlighted = hljs.highlight(text, { language }).value;
            return `<pre class="md-code" data-lang="${language}"><code class="hljs language-${language}">${highlighted}</code></pre>`;
        },
        link({ href, title, tokens }) {
            const inner = this.parser.parseInline(tokens);
            const external = /^https?:\/\//.test(href);
            const attrs = [
                `href="${href}"`,
                title ? `title="${title}"` : "",
                external ? 'target="_blank" rel="noopener noreferrer"' : "",
            ]
                .filter(Boolean)
                .join(" ");
            return `<a ${attrs}>${inner}</a>`;
        },
    },
});

interface Section {
    id: string;
    title: string;
}

const sectionsOf = (body: string): Section[] => {
    const sections: Section[] = [];

    const walk = (tokens: TokensList) => {
        for (const token of tokens) {
            if (token.type === "heading") {
                const { depth, text } = token as Tokens.Heading;
                if (depth === 2) sections.push({ id: slugify(text), title: text });
            }
            const nested = (token as { tokens?: TokensList }).tokens;
            if (Array.isArray(nested)) walk(nested);
        }
    };

    walk(renderer.lexer(body));
    return sections;
};

interface Props {
    body: string;
}

const Markdown: React.FC<Props> = ({ body }) => {
    const html = renderer.parse(body) as string;

    return (
        <div className="markdown">
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
};

export const TableOfContents: React.FC<Props> = ({ body }) => {
    const sections = sectionsOf(body);

    if (sections.length <= 2) return null;

    return (
        <nav className="markdown-toc" aria-label="Table of contents">
            <span className="markdown-toc-title">// contents</span>
            <ol>
                {sections.map(section => (
                    <li key={section.id}>
                        <a href={`#${section.id}`}>{section.title}</a>
                    </li>
                ))}
            </ol>
        </nav>
    );
};

export default Markdown;