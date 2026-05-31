import { onceReady } from "@equicord/types/webpack";
import { ChannelStore, FluxDispatcher, SelectedChannelStore, SelectedGuildStore, UserStore } from "@equicord/types/webpack/common";
import { Settings } from "renderer/settings";

const FORMAT_PATTERN = /\{(?:username|display_name|ping|ping_count|channel|server|app_name|serv_online_count|serv_member_count|channel_desc)\}|if\(\w+\)\{/;

function hasFormatTokens(s: string) {
    return FORMAT_PATTERN.test(s);
}

function parseDiscordTitle(title: string) {
    let ping = "";
    let pingCount = 0;
    let remaining = title.trim();

    const pingNumMatch = remaining.match(/^\((\d+)\)\s*/);
    if (pingNumMatch) {
        pingCount = parseInt(pingNumMatch[1], 10);
        ping = `(${pingCount})`;
        remaining = remaining.slice(pingNumMatch[0].length);
    } else if (remaining.startsWith("•")) {
        ping = "•";
        remaining = remaining.slice(1).trim();
    }

    const parts = remaining.split(" | ");
    return {
        ping,
        pingCount,
        appName: parts[0]?.trim() || "Discord",
        channel: parts[1]?.trim() || "",
        server: parts[2]?.trim() || ""
    };
}

function applyConditionals(format: string, conditions: Record<string, boolean>): string {
    let result = "";
    let i = 0;

    while (i < format.length) {
        const ifStart = format.indexOf("if(", i);
        if (ifStart === -1) {
            result += format.slice(i);
            break;
        }

        result += format.slice(i, ifStart);

        const condEnd = format.indexOf(")", ifStart + 3);
        if (condEnd === -1) {
            result += format.slice(ifStart);
            break;
        }

        const condition = format.slice(ifStart + 3, condEnd).toLowerCase();

        if (format[condEnd + 1] !== "{") {
            result += format.slice(ifStart, condEnd + 1);
            i = condEnd + 1;

            continue;
        }

        let depth = 1;
        let j = condEnd + 2;
        while (j < format.length && depth > 0) {
            if (format[j] === "{") depth++;
            else if (format[j] === "}") depth--;

            j++;
        }

        const content = format.slice(condEnd + 2, j - 1);

        if (conditions[condition] ?? false) {
            result += content;
        }

        i = j;
    }

    return result;
}

function getTotalMemberCount(guildId: string | null): string {
    if (!guildId) return "";
    try {
        const store = Vencord.Webpack.findStore("GuildMemberCountStore") as any;
        const count = store?.getMemberCount?.(guildId);
        return count != null ? String(count) : "";
    } catch {
        return "";
    }
}

const onlineMemberCounts = new Map<string, number>();
const pendingEnsure = new Set<string>();

function setupOnlineMemberCountListeners() {
    FluxDispatcher.subscribe("GUILD_MEMBER_LIST_UPDATE", ({ guildId, groups }: any) => {
        if (!guildId || !Array.isArray(groups)) return;
        const online = groups.reduce((sum: number, g: any) => sum + (g.id === "offline" ? 0 : (g.count ?? 0)), 0);

        onlineMemberCounts.set(guildId, online);
        pushResolvedTitle();
    });

    FluxDispatcher.subscribe("ONLINE_GUILD_MEMBER_COUNT_UPDATE", ({ guildId, count }: any) => {
        if (!guildId || count == null) return;

        onlineMemberCounts.set(guildId, count);
        pushResolvedTitle();
    });
}

function ensureOnlineMemberCount(guildId: string) {
    if (onlineMemberCounts.has(guildId) || pendingEnsure.has(guildId)) return;
    pendingEnsure.add(guildId);

    try {
        const defaultChannel = (ChannelStore as any).getDefaultChannel?.(guildId);
        const channelId = defaultChannel?.id;
        if (channelId) {
            FluxDispatcher.dispatch({
                type: "GUILD_MEMBER_LIST_FETCH",
                guildId,
                channelId
            }).catch(() => {});
        }
    } catch {}

    setTimeout(() => pendingEnsure.delete(guildId), 5000);
}

function getOnlineMemberCount(guildId: string | null): string {
    if (!guildId) return "";
    const count = onlineMemberCounts.get(guildId);
    if (count != null) return String(count);
    ensureOnlineMemberCount(guildId);
    return "";
}

function resolveTitle(format: string): string {
    const currentUser = (UserStore as any).getCurrentUser?.();
    const username: string = currentUser?.username ?? "";
    const displayName: string = currentUser?.globalName ?? username;

    const { ping, pingCount, appName, channel, server } = parseDiscordTitle(document.title);
    const guildId = (SelectedGuildStore as any).getGuildId?.() ?? null;

    const channelId = (SelectedChannelStore as any).getChannelId?.() ?? null;
    const channelObj = channelId ? (ChannelStore as any).getChannel?.(channelId) : null;
    const channelDesc: string = channelObj?.topic?.trim() ?? "";

    const conditions: Record<string, boolean> = {
        in_server: server !== "",
        no_server: server === "",
        in_dm: server === "" && channel !== "",
        has_ping: pingCount > 0,
        no_ping: pingCount === 0,
        has_channel: channel !== "",
        has_channel_desc: channelDesc !== ""
    };

    const tokens: Record<string, string> = {
        username,
        display_name: displayName,
        ping,
        ping_count: String(pingCount),
        channel: channel.replace(/^@/, ""),
        server,
        app_name: appName,
        serv_online_count: getOnlineMemberCount(guildId),
        serv_member_count: getTotalMemberCount(guildId),
        channel_desc: channelDesc
    };

    const withConditionals = applyConditionals(format, conditions);
    return withConditionals.replace(/\{(\w+)\}/g, (match, key) => tokens[key] ?? match);
}

function pushResolvedTitle() {
    const { customStaticTitle, staticTitle } = Settings.store;

    if (!staticTitle || !customStaticTitle?.trim()) return;
    if (!hasFormatTokens(customStaticTitle)) return;

    VesktopNative.app.setStaticTitle(resolveTitle(customStaticTitle)).catch(() => {});
}

onceReady.then(() => {
    setupOnlineMemberCountListeners();

    FluxDispatcher.subscribe("CHANNEL_SELECT", ({ guildId }: any) => {
        if (guildId) ensureOnlineMemberCount(guildId);
    });

    const titleEl = document.querySelector("title");
    if (titleEl) {
        new MutationObserver(() => pushResolvedTitle()).observe(titleEl, { childList: true });
    }

    Settings.addChangeListener("customStaticTitle", () => pushResolvedTitle());
    Settings.addChangeListener("staticTitle", () => pushResolvedTitle());

    pushResolvedTitle();
});
