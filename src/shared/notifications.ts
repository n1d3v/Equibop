import type { Settings } from "./settings";

export interface NotificationData {
    id: number;
    title: string;
    body: string;
    avatar?: string;
}

export type NotificationAction = "click" | "close";

export function getNotificationType({
    notificationType,
    customNotificationHtml
}: Pick<Settings, "notificationType" | "customNotificationHtml">) {
    return notificationType ?? (customNotificationHtml ? "custom" : "balloon");
}

export function getBalloonPicture({ notificationBalloonPicture }: Pick<Settings, "notificationBalloonPicture">) {
    return notificationBalloonPicture === "app-icon" || notificationBalloonPicture === "hidden"
        ? notificationBalloonPicture
        : "profile-picture";
}
