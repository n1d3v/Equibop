import { type BrowserWindow, screen, type Size } from "electron";
import { readFile } from "fs/promises";
import { pathToFileURL } from "url";

const SETTINGS_TAG = /<notificationSettings\b[^>]*>/i;
const ATTRIBUTES = /\s(width|height|screenpos|timeout)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/gi;
const POSITION = /^(top|middle|bottom)?(left|center|right)?$/;
const MARGIN = 16;

interface TemplateFields {
    title: string;
    body: string;
    avatar: string;
    appIcon: string;
}

function positiveNumber(value: string | undefined, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function offset(space: number, alignment: "start" | "center" | "end") {
    const margin = Math.min(MARGIN, Math.floor(space / 2));
    if (alignment === "start") return margin;
    if (alignment === "end") return space - margin;
    return Math.floor(space / 2);
}

function fitDimension(size: number, available: number) {
    return Math.min(available, Math.max(1, Math.ceil(size)));
}

export async function loadNotificationTemplate(path: string) {
    const html = await readFile(path, "utf8");
    const tag = html.match(SETTINGS_TAG)?.[0] ?? "";
    const attributes = Object.fromEntries(
        Array.from(tag.matchAll(ATTRIBUTES), ([, key, doubleQuoted, singleQuoted, unquoted]) => [
            key.toLowerCase(),
            doubleQuoted ?? singleQuoted ?? unquoted
        ])
    );

    const position = attributes.screenpos
        ?.trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "");
    const [, vertical, horizontal] = (position && POSITION.exec(position)) || ["", "bottom", "right"];
    const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const hugWidth = attributes.width?.trim().toLowerCase() === "hug";
    const hugHeight = attributes.height?.trim().toLowerCase() === "hug";
    const fixedWidth = Math.round(positiveNumber(attributes.width, 360));
    const fixedHeight = Math.round(positiveNumber(attributes.height, 112));
    const horizontalAlignment = horizontal === "left" ? "start" : horizontal === "right" ? "end" : "center";
    const verticalAlignment = vertical === "top" ? "start" : vertical === "bottom" ? "end" : "center";

    function getBounds(contentSize?: Size) {
        const width = fitDimension(hugWidth ? (contentSize?.width ?? workArea.width) : fixedWidth, workArea.width);
        const height = fitDimension(hugHeight ? (contentSize?.height ?? 1) : fixedHeight, workArea.height);
        const x = workArea.x + offset(workArea.width - width, horizontalAlignment);
        const y = workArea.y + offset(workArea.height - height, verticalAlignment);
        return { x, y, width, height };
    }

    const markup = html.replace(SETTINGS_TAG, "").replace(/<\/notificationSettings\s*>/i, "");
    return {
        url: `data:text/html;charset=utf-8;base64,${Buffer.from(markup).toString("base64")}`,
        baseUrl: pathToFileURL(path).href,
        getBounds,
        hugWidth,
        hugHeight,
        timeout: Math.min(2_147_483_647, positiveNumber(attributes.timeout, 5) * 1000)
    };
}

export async function renderNotificationTemplate(
    win: BrowserWindow,
    template: Awaited<ReturnType<typeof loadNotificationTemplate>>,
    fields: TemplateFields
) {
    await win.loadURL(template.url, { baseURLForDataURL: template.baseUrl });

    const { webContents } = win;
    await webContents.insertCSS(":where(#notification-content) { white-space: pre-wrap; overflow-wrap: anywhere; }");

    const measure = template.hugWidth || template.hugHeight;
    const measurementStyle = measure
        ? await webContents.insertCSS(
              `html { scrollbar-width: none; ${template.hugWidth ? "width: fit-content;" : ""} }`
          )
        : undefined;
    const size: Size | undefined = await webContents.executeJavaScript(
        `(${fillTemplate.toString()})(${JSON.stringify(fields)}, ${measure})`
    );
    if (size) win.setBounds(template.getBounds(size));
    if (measurementStyle) await webContents.removeInsertedCSS(measurementStyle);
}

async function fillTemplate(fields: TemplateFields, measure: boolean) {
    const header = document.getElementById("notification-header");
    const content = document.getElementById("notification-content");
    const avatar = document.getElementById("profile-picture");
    const appIcon = document.getElementById("app-icon");
    if (header) header.textContent = fields.title;
    if (content) content.textContent = fields.body;
    if (avatar instanceof HTMLImageElement) avatar.src = fields.avatar;
    if (appIcon instanceof HTMLImageElement) appIcon.src = fields.appIcon;

    if (!measure) return;

    const images = [avatar, appIcon].filter(image => image instanceof HTMLImageElement);
    await Promise.allSettled([document.fonts.ready, ...images.map(image => image.decode())]);
    return {
        width: document.documentElement.getBoundingClientRect().width,
        height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    };
}
