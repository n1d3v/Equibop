import { onceReady } from "@equicord/types/webpack";
import { ChannelStore, FluxDispatcher, SelectedChannelStore, SelectedGuildStore, UserStore } from "@equicord/types/webpack/common";
import { Settings } from "renderer/settings";
import { hasStaticTitleTokens } from "shared/staticTitleFormat";

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

        const rawCondition = format.slice(ifStart + 3, condEnd);
        const negated = rawCondition.startsWith("!");
        const condition = (negated ? rawCondition.slice(1) : rawCondition).toLowerCase();

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
        const condValue = conditions[condition] ?? false;
        const passes = negated ? !condValue : condValue;

        let elseContent = "";
        if (format.slice(j, j + 5) === "else{") {
            let depth2 = 1;
            let k = j + 5;
            while (k < format.length && depth2 > 0) {
                if (format[k] === "{") depth2++;
                else if (format[k] === "}") depth2--;

                k++;
            }

            elseContent = format.slice(j + 5, k - 1);
            j = k;
        }

        if (passes) {
            result += applyConditionals(content, conditions);
        } else if (elseContent) {
            result += applyConditionals(elseContent, conditions);
        }

        i = j;
    }

    return result;
}

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

function formatClock(date: Date, useUTC: boolean, use12h: boolean): string {
    const hours = useUTC ? date.getUTCHours() : date.getHours();
    const mm = pad2(useUTC ? date.getUTCMinutes() : date.getMinutes());
    const hh = use12h ? String(hours % 12 || 12) : pad2(hours);

    return `${hh}:${mm}`;
}

function resolveTimeToken(suffix: string, use12h: boolean): string {
    const now = new Date();
    if (!suffix) return formatClock(now, false, use12h);

    const match = suffix.match(/^-utc([+-]\d{1,2})?$/);
    const offset = match?.[1];
    if (!offset) return formatClock(now, true, use12h);

    return formatClock(new Date(now.getTime() + Number(offset) * 60 * 60_000), true, use12h);
}

function resolveAmPmToken(caps: boolean): string {
    const suffix = new Date().getHours() >= 12 ? "pm" : "am";
    return caps ? suffix.toUpperCase() : suffix;
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

    const { ping, pingCount, channel, server } = parseDiscordTitle(document.title);
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
        has_channel_desc: channelDesc !== "",
        in_forum: channelObj?.type === 15
    };

    const tokens: Record<string, string> = {
        username,
        display_name: displayName,
        ping,
        channel: channel.replace(/^@/, ""),
        server,
        serv_online_count: getOnlineMemberCount(guildId),
        serv_member_count: getTotalMemberCount(guildId),
        channel_desc: channelDesc
    };

    const withConditionals = applyConditionals(format, conditions);

    const use12h = withConditionals.includes("{12h");
    const withTime = withConditionals.replace(/\{time((?:-utc(?:[+-]\d{1,2})?)?)\}/g, (_match, suffix: string) =>
        resolveTimeToken(suffix, use12h)
    );
    const with12h = withTime.replace(/\{12h(-caps)?\}/g, (_match, capsFlag) => resolveAmPmToken(!!capsFlag));

    return with12h.replace(/\{(\w+)\}/g, (match, key) => tokens[key] ?? match);
}

function pushResolvedTitle() {
    const { customStaticTitle, staticTitle } = Settings.store;

    if (!staticTitle || !customStaticTitle?.trim()) return;
    if (!hasStaticTitleTokens(customStaticTitle)) return;

    VesktopNative.app.setStaticTitle(resolveTitle(customStaticTitle)).catch(() => {});
}

let clockInterval: ReturnType<typeof setInterval> | null = null;

function updateClockInterval() {
    const { customStaticTitle, staticTitle } = Settings.store;
    const needsClock = !!staticTitle && /\{(?:time|12h)/.test(customStaticTitle ?? "");

    if (needsClock && !clockInterval) {
        clockInterval = setInterval(pushResolvedTitle, 15_000);
    } else if (!needsClock && clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
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

    Settings.addChangeListener("customStaticTitle", () => {
        pushResolvedTitle();
        updateClockInterval();
    });
    Settings.addChangeListener("staticTitle", () => {
        pushResolvedTitle();
        updateClockInterval();
    });

    pushResolvedTitle();
    updateClockInterval();
});
