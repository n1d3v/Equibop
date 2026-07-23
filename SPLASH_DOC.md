# Custom Splash Screen Documentation
This fork of Equibop has support for custom splash screens via HTML files, these files can have their own independent CSS and JavaScript.

This allows you to better suit the program for what you are trying to customize Equibop as.

## `<splashSettings>`
To set the width and height of the splash screen window, you can put the `<splashSettings>` tag inside of `<head>`, you can configure it like:

```html
<!-- Put this inside of the <head> tag -->
<splashSettings width="300" height="300">
```