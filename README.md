# FASTBuild Language Server and Visual Studio Code Client Extension

Contains a language server and Visual Studio Code client for the [FASTBuild](https://www.fastbuild.org/) language.

  * [Functionality](#functionality)
  * [Limitations](#limitations)
  * [Compatibility](#compatibility)
  * [Installing the Visual Studio Code Extension](#installing-the-visual-studio-code-extension)
  * [Contributing](#contributing)
    * [Running](#running)
    * [Testing](#testing)
    * [Releasing the Visual Studio Code Extension](#releasing-the-visual-studio-code-extension)
    * [Implementation Notes](#implementation-notes)
    * [TODO](#todo)

## Functionality

This provides the following functionality:
* Go to definition of a variable.
* Find references of a variable.
* Hover over an evaluated variable to show a tooltip with its evaulated value (e.g. the evaluated `Location` variable in `.Message = 'Hello $Location$` or `.Message = .Location`).
* Show diagnostics for errors.

It does not yet provide syntax highlighting. For that, I recommend the FASTBuild (`roscop.fastbuild`) extension ([extension website](https://marketplace.visualstudio.com/items?itemName=RoscoP.fastbuild)).

## Limitations

* The language server cannot know what environment variables will exist when FASTBuild is run, since they might be different than the environment variables that exist when the language server runs, so:
    * `#if exists(...)` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#if)) always evaluates to false.
    * `#import` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#import)) uses a placeholder value instead of reading the actual environement variable value.

## Compatibility

Compatible with [FASTBuild](https://www.fastbuild.org/) version 1.03 ([FASTBuild Changelog](https://www.fastbuild.org/docs/changelog.html)).

It may be compatible with a newer version of FASTBuild, but this was the latest version tested.

Note that some of the language is not yet implemented. See [TODO](#todo) for details.

## Installing the Visual Studio Code Extension

TODO

## Contributing

### Running

1. Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder.
2. Open VS Code on this folder.
3. Run the `compile` task, which compiles the client and server. Alternatively, run the `watch-compile` task to watch for changes and automatically compile.
4. Run the `Launch Client` launch configuration. If you want to debug the server as well, use `Launch Client + Server` instead.

### Testing

* Run the `test` task. Alternatively, run the `watch-test` task to watch for changes and automatically run tests.
* Debug the tests by running the `Run Tests` launch configuration.

### Releasing the Visual Studio Code Extension

TODO

### Implementation Notes

* Parses using [Nearley](https://nearley.js.org/), which lexes using [moo](https://github.com/no-context/moo).
    * [Nearley Parser Playground](https://omrelli.ug/nearley-playground/)
    * Example: [Moo.js Tokenizer with Nearley.js](https://www.youtube.com/watch?v=GP91_duEmk8)
* VS Code language server extension resources:
    * [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
    * [How to create a language server and VS Code extension](https://github.com/donaldpipowitch/how-to-create-a-language-server-and-vscode-extension)
    * [Language Server Protocol: A Language Server For DOT With Visual Studio Code](https://tomassetti.me/language-server-dot-visual-studio/)
* Other resources:
    * [RegEx101](https://regex101.com/): regex playgound

### TODO

Fix bugs:
* Disallow arrays of booleans, arrays of integers, and arrays of arrays. Only array of strings and arrays of structs are allowed.

Support full FASTBuild syntax:
* Support the `ListDependencies` function ([docs](https://www.fastbuild.org/docs/functions/listdependencies.html)), which was added in FASTBuild v1.03.
* Support user functions ([docs](https://www.fastbuild.org/docs/syntaxguide.html#userfunctions)).

Release a Visual Studio Code extension ([docs](https://code.visualstudio.com/api/get-started/wrapping-up#testing-and-publishing)).
* Update the [README's release instructions](#releasing-the-visual-studio-code-extension).
* Update the [README's install instructions](#installing-the-visual-studio-code-extension).

Add more language server provider features:
* Support listing document symbols, including alias names ([docs](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#show-all-symbol-definitions-within-a-document)).
* Support "go to definition" and "find references" for aliases.
* Speed up evaluation by evaluating incrementally instead of re-evaluating everything any time any file changes.
* Support `ForEach` iterating over multiple arrays at a time (single array iterating already supported) ([docs](https://www.fastbuild.org/docs/functions/foreach.html)). This is low priority, since I have never seen it used.

Improve docs:
* Update the [Implementation Notes](#implementation-notes) section with a high-level architecture (lexer, parser, evaluator).
* Update the [Implementation Notes](#implementation-notes) section with a file-layout overview.