import { Text, Button } from "@equicord/types/components";
import { Margins } from "@equicord/types/utils";
import { Select, showToast } from "@equicord/types/webpack/common";
import { getBalloonPicture, getNotificationType } from "shared/notifications";

import { SimpleErrorBoundary } from "../SimpleErrorBoundary";
import { SettingsComponent } from "./Settings";

export const NotificationSettings: SettingsComponent = ({ settings }) => {
    const notificationType = getNotificationType(settings);
    const balloonPicture = getBalloonPicture(settings);

    return (
        <SimpleErrorBoundary>
            <Text size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                Notification Type
            </Text>
            <Select
                options={[
                    { label: "Windows Balloon", value: "balloon" },
                    { label: "Custom HTML", value: "custom" }
                ]}
                closeOnSelect
                select={value => (settings.notificationType = value)}
                isSelected={value => value === notificationType}
                serialize={value => value}
            />
            <div className={Margins.top16}>
                {notificationType === "balloon" ? (
                    <>
                        <Text size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                            Balloon Picture
                        </Text>
                        <Select
                            options={[
                                { label: "Profile Picture", value: "profile-picture" },
                                { label: "Equibop App Icon", value: "app-icon" },
                                { label: "Hidden", value: "hidden" }
                            ]}
                            closeOnSelect
                            select={value => (settings.notificationBalloonPicture = value)}
                            isSelected={value => value === balloonPicture}
                            serialize={value => value}
                        />
                    </>
                ) : (
                    <NotificationTemplateSettings settings={settings} />
                )}
            </div>
        </SimpleErrorBoundary>
    );
};

const NotificationTemplateSettings: SettingsComponent = ({ settings }) => {
    const selectTemplate = async () => {
        const path = await VesktopNative.fileManager.selectNotificationHtml();
        if (!path) return;

        settings.customNotificationHtml = path;
        showToast({ text: "Custom notification template updated." });
    };

    return (
        <div>
            <Text size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                Custom Notification HTML
            </Text>
            <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px" }}>
                Choose a local HTML template for desktop notifications. Windows balloons are used if the template is
                missing or fails to load.
            </Text>
            {settings.customNotificationHtml && (
                <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px", wordBreak: "break-all" }}>
                    Current: {settings.customNotificationHtml}
                </Text>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
                <Button onClick={selectTemplate}>Choose HTML File</Button>
                {settings.customNotificationHtml && (
                    <Button variant="secondary" onClick={() => (settings.customNotificationHtml = undefined)}>
                        Clear Template
                    </Button>
                )}
            </div>
        </div>
    );
};
