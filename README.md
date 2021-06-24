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

Add server tests. This will also be useful for using in benchmarks.

Fix bugs:
* Disallow arrays of booleans, arrays of integers, and arrays of arrays. Only array of strings and arrays of structs are allowed.

Support full FASTBuild syntax:
* Support the `ListDependencies` function ([docs](https://www.fastbuild.org/docs/functions/listdependencies.html)), which was added in FASTBuild v1.03.
* Support user functions ([docs](https://www.fastbuild.org/docs/syntaxguide.html#userfunctions)).
* Support `ForEach` iterating over multiple arrays at a time (single array iterating already supported) ([docs](https://www.fastbuild.org/docs/functions/foreach.html)). This is low priority, since I have never seen it used.

Release a Visual Studio Code extension ([docs](https://code.visualstudio.com/api/get-started/wrapping-up#testing-and-publishing)).
* Update the [README's release instructions](#releasing-the-visual-studio-code-extension).
* Update the [README's install instructions](#installing-the-visual-studio-code-extension).

Add more language server provider features:
* Support listing document symbols, including alias names ([docs](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#show-all-symbol-definitions-within-a-document)).
* Support "go to definition" and "find references" for aliases.

Improve performance:
* Add server benchmarks.
* Prevent unnecessarily re-evaluating on every keystroke while the user is typing. 
    * Potential solution #1: When a document-update event occurs while an existing one is still being processed, cancel the existing processing. Do so by: pass through a cancellation token, intermittently check if it has been canceled, and either return or raise an exception if so.
    * Potential solution #2: Add a "debounce". Wait until X milliseconds have passed since the last document change before processing the change.
        * Example: https://github.com/microsoft/vscode/blob/7bd6470e00f9aca9d8a4661778b94f31836142ce/extensions/json-language-features/server/src/jsonServer.ts#L305-L336
* Speed up evaluation by evaluating incrementally instead of re-evaluating everything any time any file changes.
    * Potential solution #1a: when editing a file, reuse the evaluation state that existed prior to importing the file.
        * Keep a cache that maps a file URI to the evaluation state (result and context) prior to first importing that file.
        * At least for the initial implementation, this cache has a size of 1, and we clear it before adding a new file.
        * When a document-update event occurs to a file that exists in the cache, bootstrap the evaluation with the cached evaluation state.
        * When evaluating an import statement, first call an `onBeforeImportFile` callback. The callback will check if the file is the same as the one being edited and if so, clear the cache and add the new file/state. It first clears the cache because the existing cached state might now be invalid.
    * Potential solution #1b: when editing a file, reuse the evaluation state that existed prior to the second import of the file (or the final evaluation state if the file was only imported once), if the post-first-import evaluation state is the same as the previous evaluation state that existed prior to first importing the file.
        * Keep a cache that maps a file URI to the following.
            * The evaluation state (result and context) after first importing that file
            * The evaluation state (result and context) prior to the second import of the file (or the final evaluation state if the file was only imported once)
        * Strategy:
            1. Before evaluating, run through the statements to calculate the first and second import, if any, of the file being edited.
            2. After evaluating an import statement, call an `onAfterImportFile` callback.
            3. The callback will check if the file is the same as the one being edited.
                * If so, check if the cached state is the same as the new state.
                    * If so, check if this is the first import of the file:
                        * If so, return the following:
                            * The cached evaluation state (result and context) prior to the second import of the file (or the final evaluation state if the file was only imported once).
                            * A directive to skip evaluation ahead to just before the second import of the file (or the end if the file was only imported once).
                        * Else:
                            1. Clear the cached evaluation state (result and context) prior to the second import of the file. It first clears the cache because the existing cached state might now be invalid.
                            2. Replace the evaluation state (result and context) after first importing that file.
                    * Else, check if this is the second import of the file. If so:
                        * Set the cached evaluation state (result and context) prior to the second import of the file.
                * Else, clear the cache and add the new file and evaluation state (result and context) after first importing that file. It first clears the cache because the existing cached state might now be invalid.
    * Potential solution #2:
        * Keep running total of statement number
        * Use metric to decide whether to cache. Maybe number of statements? Maybe every scope? Maybe by file?
        * If cache, store (statement number, inputs, outputs), where inputs is the value of and variables read from outside the scope, and outputs is the value of variables modified outside the scope.
        * On processing scope, if cached and inputs are the same, set the outputs and skip processing the scope.

Improve docs:
* Update the [Implementation Notes](#implementation-notes) section with a high-level architecture (lexer, parser, evaluator).
* Update the [Implementation Notes](#implementation-notes) section with a file-layout overview.