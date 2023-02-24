# v0.1.7

* Fixed a bug where `ForEach` kept variable definitions across loop iterations. An example of how this bug manifested is that adding to a "current-scope non-existant, parent-scope existant, current-scope variable" in a `ForEach` loop added to the previous loop-iteration value instead of redefining it each time.


# v0.1.6

* [#7](https://github.com/harrisont/fbuild-vscode-lsp/issues/7) Wait for a delay before updating (debounce), to improve performance.

# v0.1.5

* Clarified that it's compatible with FASTBuild 1.08 (no changes necessary - already compatible).

# v0.1.4

Initial release.