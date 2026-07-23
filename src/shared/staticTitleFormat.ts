const STATIC_TITLE_TOKEN_PATTERN =
    /\{(?:username|display_name|ping|channel|server|serv_online_count|serv_member_count|channel_desc)\}|\{time(?:-utc(?:[+-]\d{1,2})?)?\}|\{12h(?:-caps)?\}|if\(!?\w+\)\{|else\{/;

export function hasStaticTitleTokens(title: string): boolean {
    return STATIC_TITLE_TOKEN_PATTERN.test(title);
}