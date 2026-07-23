const STATIC_TITLE_TOKEN_PATTERN =
    /\{(?:username|display_name|ping|channel|server|serv_online_count|serv_member_count|channel_desc)\}|\{time(?:-utc(?:[+-]\d{1,2})?)?\}|\{12h(?:-caps)?\}|if\(!?\w+\)\{|else\{/;

const LINE_BREAK_PATTERN = /[\r\n]+/g;

export function hasStaticTitleTokens(title: string): boolean {
    return STATIC_TITLE_TOKEN_PATTERN.test(title);
}

export function stripLineBreaks(value: string): string {
    return value.replace(LINE_BREAK_PATTERN, " ");
}

export function sanitizeTitle(title: string): string {
    return stripLineBreaks(title).trim();
}
