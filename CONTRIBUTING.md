# How to contribute changes

## Steps

1. [Build and run/debug the extension](#build-and-rundebug-the-extension).
2. Make your change, including:
    1. The change itself.
    2. Update the `version` in [package.json](package.json).
    3. Update [CHANGELOG.md](CHANGELOG.md) with the release notes for the new version.
3. [Run/debug tests](#rundebug-tests).
4. Submit a [pull request](https://github.com/harrisont/fbuild-vscode-lsp/pulls) with the change for review.
5. Once the PR is accepted, create a new release, using a new release tag for the new version. Include the release notes from [CHANGELOG.md](CHANGELOG.md). This will automatically publish the extension to the VS Code Marketplace via the GitHub Action.

## Build and run/debug the extension

1. Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder.
2. Open VS Code on this folder.
3. Run the `build` task, which builds the client and server. Alternatively, run the `watch-build` task to watch for changes and automatically build.
4. Run the `Launch Client` launch configuration. If you want to debug the server as well, use `Launch Client + Server` instead.

## Run/debug Tests

* Run the `test` task. Alternatively, run the `watch-test` task to watch for changes and automatically run tests.
* Debug the tests by running the `Run Tests` launch configuration.

## About the code

* Parses using the [Nearley](https://nearley.js.org/) parser generator, which lexes using [moo](https://github.com/no-context/moo).
    * [Nearley Parser Playground](https://omrelli.ug/nearley-playground/)
    * Example: [Moo.js Tokenizer with Nearley.js](https://www.youtube.com/watch?v=GP91_duEmk8)
* VS Code language server extension resources:
    * [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
    * [How to create a language server and VS Code extension](https://github.com/donaldpipowitch/how-to-create-a-language-server-and-vscode-extension)
    * [Language Server Protocol: A Language Server For DOT With Visual Studio Code](https://tomassetti.me/language-server-dot-visual-studio/)
* Other resources:
    * [RegEx101](https://regex101.com/): regex playgound
