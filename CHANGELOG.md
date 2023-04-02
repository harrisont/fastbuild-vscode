# v0.5.2

## Changes

* Added demo videos to the README

# v0.5.1

## Bug Fixes

* `#if exists(...)` now correctly evaluates if the environment variable exists instead of always being false (#23).

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

* [#4](https://github.com/harrisont/fastbuild-vscode/issues/4) Support listing document and workspace symbols.

# v0.1.9

* [#6](https://github.com/harrisont/fastbuild-vscode/issues/6) Support `ForEach` iterating over multiple arrays at a time (single array iterating already supported). This completes support for the full FASTBuild language.

# v0.1.8

* Rename repository from `fbuild-vscode-lsp` to `fastbuild-vscode`.

# v0.1.7

* Fixed a bug where `ForEach` kept variable definitions across loop iterations. An example of how this bug manifested is that adding to a "current-scope non-existant, parent-scope existant, current-scope variable" in a `ForEach` loop added to the previous loop-iteration value instead of redefining it each time.


# v0.1.6

* [#7](https://github.com/harrisont/fastbuild-vscode/issues/7) Wait for a delay before updating (debounce), to improve performance.

# v0.1.5

* Clarified that it's compatible with FASTBuild 1.08 (no changes necessary - already compatible).

# v0.1.4

Initial release.
