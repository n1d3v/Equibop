# Custom Splash Screen Documentation
This fork of Equibop has support for custom splash screens via HTML files, these files can have their own independent CSS and JavaScript.

This allows you to better suit the program for what you are trying to customize Equibop as.

> [!NOTE]
> The default dimensions of the custom splash screen are 300x350, and the background can be transparent, keep this in mind for when you are creating a splash screen.

## `<splashSettings>`
To set the width and height of the splash screen window, you can put the `<splashSettings>` tag inside of `<head>`, you can configure it like:

```html
<!-- Put this inside of the <head> tag -->
<splashSettings width="300" height="300">
```