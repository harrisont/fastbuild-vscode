# v0.16.0

## New Features

* ([#82](https://github.com/harrisont/fastbuild-vscode/issues/82)) Add a new optional `Root File` setting to control the FASTBuild root `fbuild.bff` file. The root file normally does not need to be specified in the settings because it is detected automatically when it is in a parent directory. But it is necessary to set when invoking FASTBuild with the `-config <path>` command line option, which overrides the root file.

    For example, if you have the following files and run FASTBuild with `fbuild -config <workspace_root>/Projects/fbuild.bff`:
    ```
    <workspace_root>/Projects/fbuild.bff
    <workspace_root>/Projects/HelloWorld/HelloWorld.bff
    <workspace_root>/External/MSVC/MSVC.bff
    ```
    In this example, `MSVC.bff` by default cannot find the root `fbuild.bff`. So it is necessary to use the `Root File` setting to manually specify the root.

# v0.15.0

## New Features

* Support auto-completion for variables.

    Example:
    ![Example](https://github.com/harrisont/fastbuild-vscode/assets/144260/971aa929-34d0-4de3-a635-f777e86cc33d)

# v0.14.2

## New Features

* Increase FASTBuild support from v1.08 to v1.11 ([FASTBuild Changelog](https://www.fastbuild.org/docs/changelog.html)). Previously the plugin worked for v1.11, but didn't support every features added after v1.08. Specifically support for the `_FASTBUILD_EXE_PATH_` builtin variable (added in FASTBuild v1.09).

# v0.14.1

## Bug Fixes

* ([#71](https://github.com/harrisont/fastbuild-vscode/issues/71)) Fix the syntax highlighting when using a period in a variable name when using it in a string template.

# v0.14.0

## New Features

* ([#13](https://github.com/harrisont/fastbuild-vscode/issues/13)) Support auto-completion for function properties, including both inline documentation and a link to the official function's documentation.

    Example:
    ![Example](https://github.com/harrisont/fastbuild-vscode/assets/144260/fb0ccd56-5b12-41f5-9b29-4ca7f34027ee)

# v0.13.4

## Bug Fixes

* ([#71](https://github.com/harrisont/fastbuild-vscode/issues/71)) Fix the bug where a period in a variable name generates a syntax error when using it in a string template.

# v0.13.3

## Bug Fixes

* ([#70](https://github.com/harrisont/fastbuild-vscode/issues/70)) Fix the bug where a `;` or `//` (start-of-comment characters) in a string would cause the rest of the line to be treated as a comment and would create a parse error.

# v0.13.2

## Bug Fixes

* ([#69](https://github.com/harrisont/fastbuild-vscode/issues/69)) Fix the `ForEach` loop variable to only be defined within the loop. Previously it was incorrectly defined in its parent scope, so it was still defined after the `ForEach` call.

# v0.13.1

## Bug Fixes

* ([#67](https://github.com/harrisont/fastbuild-vscode/issues/67)) Fix the errors not updating when changing a file to introduce a parse error and then undoing that change.

# v0.13.0

## New Features

* Add basic syntax highlighting for user function definitions. Note that this does not support syntax highlighting for user function calls.

# v0.12.0

## New Features

* ([#62](https://github.com/harrisont/fastbuild-vscode/issues/62)) Error when missing a required function property.

# v0.11.0

## New Features

* ([#64](https://github.com/harrisont/fastbuild-vscode/issues/64)) Support jumping to the existing definition for redefinition errors. Supports `#define`s, target aliases, and user-function names.

# v0.10.2

## Performance improvements

* ([#59](https://github.com/harrisont/fastbuild-vscode/issues/59)) Stop unnecessarily re-parsing and re-evaluating when holding `Ctrl`  (the go-to-definition hotkey) and hovering over a variable/include whose definition is in an unopened file. This significantly improves performance in these scenarios.

# v0.10.1

## Bug Fixes

* ([#58](https://github.com/harrisont/fastbuild-vscode/issues/58)) Fix "go to references" bug where it errored when there are no references. This bug was introduced in [v0.10.0](#v0100) in [commit 8cfa091](https://github.com/harrisont/fastbuild-vscode/commit/8cfa091e1634e01d8e8f5e058bbbab6910cf8329).

# v0.10.0

## New Features

* ([#54](https://github.com/harrisont/fastbuild-vscode/issues/54)) "Go to definition" on a variable created by `Using` now also includes the definition from the `Using`'s struct's field. This makes it easier to find the origin of the field's value. Note that this was already possible using "go to references", just not using "go to definition".

# v0.9.4

## Bug Fixes

* ([#52](https://github.com/harrisont/fastbuild-vscode/issues/52)) Allow escaping all characters, not just `^`, `$`, `'`, and `"`.

# v0.9.3

## Bug Fixes

* ([#50](https://github.com/harrisont/fastbuild-vscode/issues/50)) Make "go to references" support multiple references with the same location but to different definitions.

# v0.9.2

## Bug Fixes

* ([#47](https://github.com/harrisont/fastbuild-vscode/issues/47)) Fix variable hover value syntax highlighting for strings with `"` in them.

# v0.9.1

## Bug Fixes

* Fix bug where the error message from duplicate target names said the existing target definition location was at "{Object}". Now it says the file and range.

# v0.9.0

## New Features

* ([#44](https://github.com/harrisont/fastbuild-vscode/issues/44)) "Go to definition" now supports multiple definitions. This can be useful when a variable reference has multiple definitions, due to being in a loop or being in a file that is included multiple times. For example, `ForEach` looping over an array of structs, with a `Using` on that struct, referencing a variable in that struct in the loop has multiple definitions, one for each definition in the struct in the array.

# v0.8.0

## New Features

* Support folding (collapsing code blocks) for `#if...#endif`.

# v0.7.1

## Changes

* ([#41](https://github.com/harrisont/fastbuild-vscode/issues/41)) Add syntax highlighting to the functionality list in the README (the feature itself was added in the previous release, v0.7.0).

# v0.7.0

## New Features

* ([#41](https://github.com/harrisont/fastbuild-vscode/issues/41)) Add syntax highlighting. Now it's no longer necessary to use a separate extension.

# v0.6.1

## Bug Fixes

* The extension now defines the FASTBuild language, so that the extension works without requiring the `RoscoP.fastbuild` extension. That extension is still useful for syntax highlighting.

# v0.6.0

## New Features

* ([#36](https://github.com/harrisont/fastbuild-vscode/issues/36)) Support "Go To Definition" and "Go to References" for `#include`s.

# v0.5.11

## Changes

* Update README to clarify that the evaluated variable values shown on hover are deduplicated.

# v0.5.10

## Bug Fixes

* Fix bug where hover values did not deduplicate complex values. It deduplicated boolean/number/string values, but not arrays or structs.

# v0.5.9

## Bug Fixes

* ([#38](https://github.com/harrisont/fastbuild-vscode/issues/38)) Fix a bug where very long (>100,000 characters) evaluated variable hover values don't render correctly, because VS Code truncates them. Now the extension truncates them before hitting the limit, so it still renders correctly.

# v0.5.8

## Bug Fixes

* ([#31](https://github.com/harrisont/fastbuild-vscode/issues/31)) Fix a bug where the `ForEach` loop variable did not appear on hover or on "go to document symbols".

# v0.5.7

## Changes

* ([#28](https://github.com/harrisont/fastbuild-vscode/issues/28)) Stop returning duplicates for "get document/workspace symbols". This makes the results more usable. Additionally, in experiments on a large code base, this makes "get workspace symbols" twice as fast.

# v0.5.6

## Bug fixes

* ([#27](https://github.com/harrisont/fastbuild-vscode/issues/27)) Fix bug where the document symbols are missing data from the last change.

# v0.5.5

## Changes

* Optimizations to speed up evaluation. From a small amount of experimenting, this cuts evaluation time to a third of what it was before.

# v0.5.4

## New Features

* Add a new `inputDebounceDelay` setting to control the delay after changing a document before re-evaluating it.

## Other Changes

* Add logging to measure performance. This is controlled by the new `logPerformanceMetrics` setting, which is disabled by default.

# v0.5.3

## Changes

* Convert the demo videos from `.mov` to `.gif` so that they can show in the Visual Studio Code Extension Marketplace.

# v0.5.2

## Changes

* Added demo videos to the README

# v0.5.1

## Bug Fixes

* ([#23](https://github.com/harrisont/fastbuild-vscode/issues/23)) `#if exists(...)` now correctly evaluates if the environment variable exists instead of always being false.

# v0.5.0

## New Features

* Support "go to definition" and "find references" for `#define`s:
    * [`#define` / `#undef` FASTBuild docs](https://www.fastbuild.org/docs/syntaxguide.html#define)
    * [`#if` / `#else` / `#endif` FASTBuild docs](https://www.fastbuild.org/docs/syntaxguide.html#if)

# v0.4.0

## New Features

* Support environment variables.
    * `#if exists(...)` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#if)) now checks the actual environment variable instead of always evaluating to false.
    * `#import` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#import)) now reads the actual environment variable instead of using a placeholder value.

# v0.3.1

## Bug fixes

* Fix bug where the partial evaluated data was discarded if there was an error. This prevented being able to access things like hover information on the successfully evaluated data prior to the error, which was previously working.

# v0.3.0

## New Features

* You can now hover over the left-hand side of a variable assignment or modification to see the variable's new value.

# v0.2.2

* Distinguish between targets and variables in the symbol listing.

# v0.2.1

* Fix bug where document symbols are not available for documents already open at launch.

# v0.2.0

* ([#4](https://github.com/harrisont/fastbuild-vscode/issues/4)) Support listing document and workspace symbols.

# v0.1.9

* ([#6](https://github.com/harrisont/fastbuild-vscode/issues/6)) Support `ForEach` iterating over multiple arrays at a time (single array iterating already supported). This completes support for the full FASTBuild language.

# v0.1.8

* Rename repository from `fbuild-vscode-lsp` to `fastbuild-vscode`.

# v0.1.7

* Fixed a bug where `ForEach` kept variable definitions across loop iterations. An example of how this bug manifested is that adding to a "current-scope non-existent, parent-scope existent, current-scope variable" in a `ForEach` loop added to the previous loop-iteration value instead of redefining it each time.


# v0.1.6

* ([#7](https://github.com/harrisont/fastbuild-vscode/issues/7)) Wait for a delay before updating (debounce), to improve performance.

# v0.1.5

* Clarified that it's compatible with FASTBuild 1.08 (no changes necessary - already compatible).

# v0.1.4

Initial release.
