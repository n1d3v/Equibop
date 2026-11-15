# Custom Notification Documentation
This fork of Equibop allows you to use both Windows Balloons and custom HTML for notifications, custom notifications allow you to style notifications as anything.

This allows you to better suit the program for what you are trying to customize Equibop as.

```html
<!-- Notification template code! -->
<html>
    <head>
        <!-- hug makes the notification use only the space required to display it. -->
        <!-- screenpos allows you to combine positions, so `topcenter` or `bottomright` for example. -->
        <notificationSettings width="300" height="hug" screenpos="bottomcenter" timeout="5">
        <!-- Files are relative to where the HTML file is. -->
        <link rel="stylesheet" href="styles.css">
    </head>
    <body>
        <!-- id can also be set to app-icon to show the custom app icon. -->
        <img id="profile-picture" alt="">
        <p id="notification-header"></p>
        <p id="notification-content"></p>
    </body>
</html>
```

Equibop disables Windows window transitions for custom notifications. You manually need to define visual effects in the template's CSS or via JavaScript. Balloon notifications use the default tray icon of Equibop.