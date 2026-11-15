import { Settings } from "renderer/settings";
import { isWindows } from "renderer/utils";
import { getBalloonPicture, getNotificationType, type NotificationAction } from "shared/notifications";

import { addPatch } from "./shared";

const AVATAR_SIZE = 64;
const AVATAR_TIMEOUT = 1500;

let nextId = 0;
const activeNotifications = new Map<number, DesktopNotification>();

class DesktopNotification extends EventTarget {
    onclick: ((event: Event) => void) | null = null;
    onclose: ((event: Event) => void) | null = null;

    constructor(private readonly id: number) {
        super();
    }

    close() {
        VesktopNative.notifications.close(this.id).catch(() => {});
    }

    finish(action: NotificationAction) {
        try {
            if (action === "click") {
                const event = new Event("click");
                this.dispatchEvent(event);
                this.onclick?.(event);
            }
        } finally {
            const event = new Event("close");
            this.dispatchEvent(event);
            this.onclose?.(event);
        }
    }
}

async function getNotificationAvatar(icon?: string) {
    if (!icon) return;

    const url = new URL(icon, location.href);
    const isDiscordImage =
        url.origin === "https://cdn.discordapp.com" ||
        url.origin === "https://media.discordapp.net" ||
        (url.origin === location.origin && url.pathname.startsWith("/assets/"));
    if (!isDiscordImage && !/^data:image\/png;base64,/i.test(icon)) return;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url.href;
    const timeout = setTimeout(() => image.removeAttribute("src"), AVATAR_TIMEOUT);

    try {
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL();
    } finally {
        clearTimeout(timeout);
    }
}

async function showDesktopNotification(title: string, options: NotificationOptions) {
    const id = ++nextId;
    const notification = new DesktopNotification(id);
    const { store } = Settings;
    const usesCustomTemplate = getNotificationType(store) === "custom" && !!store.customNotificationHtml;
    const needsAvatar = usesCustomTemplate || getBalloonPicture(store) === "profile-picture";
    const avatar = needsAvatar ? await getNotificationAvatar(options.icon).catch(() => undefined) : undefined;
    if (id !== nextId) return notification;

    activeNotifications.set(id, notification);
    const shown = await VesktopNative.notifications
        .show({ id, title, body: options.body ?? "", avatar })
        .catch(() => false);
    if (shown) return notification;

    activeNotifications.delete(id);
    throw new Error("Could not show the Windows notification");
}

if (isWindows) {
    VesktopNative.notifications.onAction((id, action) => {
        const notification = activeNotifications.get(id);
        activeNotifications.delete(id);
        notification?.finish(action);
    });

    addPatch({
        patches: [
            {
                find: "Native notification setup failed with error:",
                replacement: {
                    match: /(?<=try\{\i=)new \i\((\i),(\i)\)(?=\}catch\(\i\)\{.{0,250}?"html5")/,
                    replace: "await $self.showDesktopNotification($1,$2)"
                }
            }
        ],
        showDesktopNotification
    });
}
