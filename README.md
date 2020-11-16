# FASTBuild Language Server and VS Code Client

Contains a language server and Visual Studio Code client for the [FASTBuild](https://www.fastbuild.org/) language.

This provides the following functionality:
* Hover over an evaluated variable (e.g. `.Message = 'Hello $Location$`, `.MyVarCopy = .MyVar`).
    * Known issue: when the RHS is another variable directly, and not a string template (e.g. `.MyVarCopy = .MyVar`), the hover extends to the end of the line instead of ending at the end of the RHS. For example, in the case of `.MyVarCopy = .MyVar  // Comment`, the hover includes the comment. The hover stil shows the correct value.

## Running

1. Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder.
2. Open VS Code on this folder.
3. Press Ctrl+Shift+B to run the `npm compile` task, which compiles the client and server. You can also run the `npm watch` task to watch for changes and automatically compile.
4. Run the `Launch Client` launch config. If you want to debug the server as well use the launch configuration `Client + Server`.

## Testing

Run `npm test` or run the `Run Tests` task.

## Notes

* Parses using [Nearley](https://nearley.js.org/), which lexes using [moo](https://github.com/no-context/moo).
    * [Nearley Parser Playground](https://omrelli.ug/nearley-playground/)
	* Example: [Moo.js Tokenizer with Nearley.js](https://www.youtube.com/watch?v=GP91_duEmk8)
* VS Code language server extension resources:
    * [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
	* [How to create a language server and VS Code extension](https://github.com/donaldpipowitch/how-to-create-a-language-server-and-vscode-extension)
	* [Language Server Protocol: A Language Server For DOT With Visual Studio Code](https://tomassetti.me/language-server-dot-visual-studio/)
* Other resources:
    * [RegExr](https://regexr.com/) regex playgound

## TODO

* Fix the hover extending to the end of the line when the RHS is another variable directly, and not a string template (e.g. `.MyVarCopy = .MyVar // Comment`). See `TODO: determine the end` in `server/src/fbuild-grammar.ne`.
* Add variable scope.