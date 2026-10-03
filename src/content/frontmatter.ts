export type FrontmatterValue = string | string[] | boolean;

export interface Frontmatter {
    data: Record<string, FrontmatterValue>;
    content: string;
}

const unquote = (value: string) => {
    const first = value[0];
    const last = value[value.length - 1];

    if (value.length > 1 && (first === '"' || first === "'") && first === last) {
        return value.slice(1, -1);
    }

    return value;
};

const scalar = (value: string): FrontmatterValue => {
    if (value === "true") return true;
    if (value === "false") return false;
    return unquote(value);
};

const parseValue = (value: string): FrontmatterValue => {
    if (value.startsWith("[") && value.endsWith("]")) {
        return value
            .slice(1, -1)
            .split(",")
            .map(item => unquote(item.trim()))
            .filter(Boolean);
    }

    return scalar(value);
};

export const parseFrontmatter = (raw: string): Frontmatter => {
    const lines = raw.split(/\r?\n/);
    const data: Record<string, FrontmatterValue> = {};
    let listKey: string | null = null;
    let index = 1;

    if (lines[0]?.trim() !== "---") return { data, content: raw.trim() };

    while (index < lines.length && lines[index].trim() !== "---") {
        const line = lines[index];

        const item = line.match(/^\s*-\s+(.*)$/);

        if (item && listKey) {
            const list = data[listKey];
            if (Array.isArray(list)) list.push(unquote(item[1].trim()));
            index += 1;
            continue;
        }

        const entry = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);

        if (!entry) {
            index += 1;
            continue;
        }

        const [, key, rest] = entry;
        listKey = key;
        data[key] = rest.trim() === "" ? [] : parseValue(rest.trim());
        index += 1;
    }

    const content = lines.slice(index + 1).join("\n").replace(/^\s*\n/, "");

    return { data, content };
};