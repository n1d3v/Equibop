import { BrowserWindow, type IpcMainInvokeEvent, nativeImage, Tray, type WebFrameMain } from "electron";
import { join } from "path";
import { IpcEvents } from "shared/IpcEvents";
import {
    getBalloonPicture,
    getNotificationType,
    type NotificationAction,
    type NotificationData
} from "shared/notifications";
import { STATIC_DIR } from "shared/paths";

import { mainWin } from "./mainWindow";
import { Settings } from "./settings";
import { handle } from "./utils/ipcWrappers";
import { loadNotificationTemplate, renderNotificationTemplate } from "./utils/notificationTemplate";
import { disableWindowTransitions } from "./utils/windowTransitions";

const DEFAULT_APP_ICON_PATH = join(STATIC_DIR, "icon.ico");
const BALLOON_SHOW_TIMEOUT = 30_000;
const BALLOON_CLEANUP_TIMEOUT = 5 * 60_000;
const BALLOON_TITLE_LIMIT = 63;
const BALLOON_CONTENT_LIMIT = 255;
const MAX_AVATAR_DATA_LENGTH = 32_000;
const TEMPLATE_LOAD_TIMEOUT = 5000;

interface ActiveNotification {
    id: number;
    owner: BrowserWindow;
    frame: WebFrameMain;
    dispose?: () => void;
    timer?: NodeJS.Timeout;
}

let activeNotification: ActiveNotification | undefined;
let defaultAppIcon: Electron.NativeImage | undefined;

function finishNotification(notification: ActiveNotification | undefined, action: NotificationAction = "close") {
    if (!notification || activeNotification !== notification) return;

    activeNotification = undefined;
    clearTimeout(notification.timer);
    notification.dispose?.();

    const { frame, owner } = notification;
    if (frame.detached || owner.isDestroyed()) return;

    if (action === "click") {
        if (owner.isMinimized()) owner.restore();
        owner.show();
        owner.setSkipTaskbar(false);
        owner.focus();
    }

    frame.send(IpcEvents.NOTIFICATION_ACTION, notification.id, action);
}

function dismissAfter(notification: ActiveNotification, timeout: number) {
    clearTimeout(notification.timer);
    notification.timer = setTimeout(() => finishNotification(notification), timeout);
}

export function initNotifications(win: BrowserWindow) {
    if (process.platform !== "win32") return;

    const close = () => {
        if (activeNotification?.owner === win) finishNotification(activeNotification);
    };
    win.once("closed", close);
    win.webContents.on("render-process-gone", close);
    win.webContents.on("did-start-navigation", ({ isMainFrame, isSameDocument }) => {
        if (isMainFrame && !isSameDocument) close();
    });
}

function getNotificationFrame({ sender, senderFrame }: IpcMainInvokeEvent) {
    if (mainWin && !mainWin.isDestroyed() && sender === mainWin.webContents && senderFrame === sender.mainFrame) {
        return senderFrame;
    }
}

function truncateBalloonText(text: string, limit: number) {
    return text
        .replaceAll("\0", "")
        .replace(/[\u2066-\u2069]/g, "")
        .slice(0, limit)
        .replace(/[\uD800-\uDBFF]$/, "");
}

function getAvatarImage(avatar?: string) {
    if (
        typeof avatar === "string" &&
        avatar.length <= MAX_AVATAR_DATA_LENGTH &&
        avatar.startsWith("data:image/png;base64,")
    ) {
        const image = nativeImage.createFromDataURL(avatar);
        if (!image.isEmpty()) return image;
    }
}

function getAppIcon() {
    const { customWindowIcon } = Settings.store;
    if (customWindowIcon) {
        const image = nativeImage.createFromPath(customWindowIcon);
        if (!image.isEmpty()) return image;
    }

    return (defaultAppIcon ??= nativeImage.createFromPath(DEFAULT_APP_ICON_PATH));
}

function showBalloon(notification: ActiveNotification, data: NotificationData) {
    const tray = new Tray(DEFAULT_APP_ICON_PATH);
    notification.dispose = () => tray.destroy();
    dismissAfter(notification, BALLOON_SHOW_TIMEOUT);

    tray.setToolTip("Equibop");
    tray.once("balloon-show", () => {
        if (activeNotification === notification) dismissAfter(notification, BALLOON_CLEANUP_TIMEOUT);
    });
    tray.once("balloon-click", () => finishNotification(notification, "click"));
    tray.once("balloon-closed", () => finishNotification(notification));

    const picture = getBalloonPicture(Settings.store);
    const avatar = picture === "profile-picture" ? getAvatarImage(data.avatar) : undefined;
    const hidePicture = picture === "hidden";
    tray.displayBalloon({
        iconType: hidePicture ? "none" : "custom",
        ...(hidePicture ? {} : { icon: avatar ?? getAppIcon() }),
        title: truncateBalloonText(data.title, BALLOON_TITLE_LIMIT) || "Equibop",
        content: truncateBalloonText(data.body.replaceAll("\n", "\r\n"), BALLOON_CONTENT_LIMIT) || " ",
        noSound: true,
        respectQuietTime: true
    });
}

async function showTemplate(notification: ActiveNotification, data: NotificationData, path: string) {
    const template = await loadNotificationTemplate(path);
    if (activeNotification !== notification) return;

    const win = new BrowserWindow({
        ...template.getBounds(),
        show: false,
        frame: false,
        thickFrame: false,
        focusable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        transparent: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            partition: "equibop-notifications"
        }
    });
    const destroy = () => {
        if (!win.isDestroyed()) win.destroy();
    };
    const close = () => finishNotification(notification);
    notification.dispose = () => {
        if (win.isDestroyed()) return;
        win.off("closed", close);
        win.destroy();
    };
    disableWindowTransitions(win);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-frame-navigate", event => event.preventDefault());
    win.webContents.once("render-process-gone", destroy);

    const loadTimeout = setTimeout(destroy, TEMPLATE_LOAD_TIMEOUT);
    try {
        const appIcon = getAppIcon().toDataURL();
        await renderNotificationTemplate(win, template, {
            title: data.title,
            body: data.body,
            avatar: getAvatarImage(data.avatar)?.toDataURL() ?? appIcon,
            appIcon
        });
    } finally {
        clearTimeout(loadTimeout);
    }

    if (activeNotification !== notification) return;
    win.once("closed", close);
    win.webContents.on("before-mouse-event", (event, { button, type }) => {
        if (button !== "left" || type !== "mouseUp") return;
        event.preventDefault();
        finishNotification(notification, "click");
    });
    win.showInactive();
    dismissAfter(notification, template.timeout);
}

handle(IpcEvents.SHOW_NOTIFICATION, async (event, data: NotificationData) => {
    if (process.platform !== "win32") return false;
    const frame = getNotificationFrame(event);
    if (!frame) return false;
    if (!data || !Number.isSafeInteger(data.id) || data.id <= 0 || typeof data.title !== "string") return false;

    finishNotification(activeNotification);
    const notification: ActiveNotification = (activeNotification = { id: data.id, owner: mainWin, frame });
    const payload = { ...data, body: typeof data.body === "string" ? data.body.replace(/\r\n?/g, "\n") : "" };

    const { customNotificationHtml } = Settings.store;
    if (getNotificationType(Settings.store) === "custom" && customNotificationHtml) {
        try {
            await showTemplate(notification, payload, customNotificationHtml);
            return true;
        } catch (err) {
            if (activeNotification !== notification) return true;
            notification.dispose?.();
            notification.dispose = undefined;
            console.error("Failed to show custom notification, falling back to a Windows balloon:", err);
        }
    }

    try {
        showBalloon(notification, payload);
        return true;
    } catch (err) {
        finishNotification(notification);
        console.error("Failed to show notification balloon:", err);
        return false;
    }
});

handle(IpcEvents.CLOSE_NOTIFICATION, (event, id: number) => {
    const notification = activeNotification;
    if (notification?.id === id && notification.frame === getNotificationFrame(event)) {
        finishNotification(notification);
    }
});
