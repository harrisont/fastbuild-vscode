# FASTBuild Language Server and VS Code Client

Based on the sample code for https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

## Running

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`

## Notes

Parses using [Nearley](https://nearley.js.org/).

[Nearley Parser Playground](https://omrelli.ug/nearley-playground/)