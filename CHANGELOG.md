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

* Convert the demo videos from `.mov` to `.gif` so that they can show in the Visual Studio Code Externsion Marketplace.

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

* Fixed a bug where `ForEach` kept variable definitions across loop iterations. An example of how this bug manifested is that adding to a "current-scope non-existant, parent-scope existant, current-scope variable" in a `ForEach` loop added to the previous loop-iteration value instead of redefining it each time.


# v0.1.6

* ([#7](https://github.com/harrisont/fastbuild-vscode/issues/7)) Wait for a delay before updating (debounce), to improve performance.

# v0.1.5

* Clarified that it's compatible with FASTBuild 1.08 (no changes necessary - already compatible).

# v0.1.4

Initial release.
