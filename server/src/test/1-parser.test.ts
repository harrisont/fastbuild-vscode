import * as assert from 'assert';

import {
    createPosition,
    createRange,
    parse,
    ParseSourceRange,
} from '../parser';

function assertParseResultsEqual(input: string, expectedResult: any[]): void {
    const result = parse(input, 'file:///dummy.bff', { enableDiagnostics: true, includeCodeLocationInError: true} );
    assert.deepStrictEqual(result.statements, expectedResult);
}

function assertInputsGenerateSameParseResult(input1: string, input2: string): void {
    const result1 = parse(input1, 'file:///dummy.bff', { enableDiagnostics: true, includeCodeLocationInError: true} );
    const result2 = parse(input2, 'file:///dummy.bff', { enableDiagnostics: true, includeCodeLocationInError: true} );
    assert.deepStrictEqual(result1.statements, result2.statements);
}

function getParseSourceRangeString(range: ParseSourceRange): string {
    return `${range.start.line}:${range.start.character} - ${range.end.line}:${range.end.character}`;
}

function assertParseSyntaxError(input: string, expectedErrorMessage: string, expectedRange: ParseSourceRange): void {
    assert.throws(
        () => parse(input, 'file:///dummy.bff', { enableDiagnostics: false, includeCodeLocationInError: true } ),
        actualError => {
            assert.strictEqual(actualError.name, 'ParseSyntaxError', `Expected a ParseSyntaxError exception but got ${actualError}:\n\n${actualError.stack}`);
            assert(actualError.message === expectedErrorMessage, `Got error message <${actualError.message}> but expected <${expectedErrorMessage}>`);
            assert.deepStrictEqual(actualError.range, expectedRange, `Expected the error range to be ${getParseSourceRangeString(expectedRange)} but it is ${getParseSourceRangeString(actualError.range)}`);
            return true;
        }
    );
}

describe('parser', () => {
    it('should work on empty input', () => {
        const input = ``;
        assertParseResultsEqual(input, []);
    });

    it('should work on space', () => {
        const input = ` `;
        assertParseResultsEqual(input, []);
    });

    it('should work on empty lines', () => {
        const input = `


        `;
        assertParseResultsEqual(input, []);
    });

    it('should work on "//" comment', () => {
        const input = `// My comment`;
        assertParseResultsEqual(input, []);
    });

    it('should work on ";" comment', () => {
        const input = `; My comment`;
        assertParseResultsEqual(input, []);
    });

    it('should work on empty comment', () => {
        const input = `//`;
        assertParseResultsEqual(input, []);
    });

    it('should work on assigning an integer', () => {
        const input = `.MyVar = 123`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(0, 9, 0, 12)
                }
            }
        ]);
    });

    it('should work on assignment with no spaces', () => {
        const input = `.MyVar=123`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(0, 7, 0, 10)
                }
            }
        ]);
    });

    it('should work on assigning an integer across multiple lines', () => {
        const input = `
            .MyVar

                =

                123
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(5, 16, 5, 19)
                }
            }
        ]);
    });

    it('should work on assigning an integer across multiple lines with a space after the LHS', () => {
        // Use a unicode space instead of a literal space to prevent people from accidentally removing the trailing whitespace.
        const input = `.MyVar\u{20}
=123`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(1, 1, 1, 4)
                }
            }
        ]);
    });

    it('should work on assigning an integer across multiple lines, with comments (spaces before comments)', () => {
        const withComments = `
            .MyVar // Comment 1

                // Comment 2
                // Comment 3
                =

                // Comment 4

                // Comment 5
                123 // Comment 6
                // Comment 7
                // Comment 8
        `;
        const withoutComments = `
            .MyVar



                =




                123


        `;
        assertInputsGenerateSameParseResult(withComments, withoutComments);
    });

    it('should work on assigning an integer across multiple lines, with comments (no spaces before comments)', () => {
        const withComments = `
            .MyVar// Comment 1

// Comment 2
// Comment 3
                =

// Comment 4

// Comment 5
                123// Comment 6
// Comment 7
// Comment 8
        `;
        const withoutComments = `
            .MyVar



                =




                123


        `;
        assertInputsGenerateSameParseResult(withComments, withoutComments);
    });

    it('should work on assigning true', () => {
        const input = `.MyVar = true`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'boolean',
                    value: true,
                    range: createRange(0, 9, 0, 13)
                }
            }
        ]);
    });

    it('should work on assigning false', () => {
        const input = `.MyVar = false`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'boolean',
                    value: false,
                    range: createRange(0, 9, 0, 14)
                }
            }
        ]);
    });

    it('should work on assigning an empty string literal', () => {
        const input = `.MyVar = ''`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: '',
                    range: createRange(0, 9, 0, 11)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with single quotes', () => {
        const input = `.MyVar = 'hi'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'hi',
                    range: createRange(0, 9, 0, 13)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with double quotes', () => {
        const input = `.MyVar = "hi"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'hi',
                    range: createRange(0, 9, 0, 13)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with single quotes with a double quote inside', () => {
        const input = `.MyVar = 'h"i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h"i',
                    range: createRange(0, 9, 0, 14)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with double quotes with a single quote inside', () => {
        const input = `.MyVar = "h'i"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h\'i',
                    range: createRange(0, 9, 0, 14)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with single quotes with an escaped single quote inside', () => {
        const input = `.MyVar = 'h^'i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: "h'i",
                    range: createRange(0, 9, 0, 15)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with double quotes with an escaped double quote inside', () => {
        const input = `.MyVar = "h^"i"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h"i',
                    range: createRange(0, 9, 0, 15)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with single quotes with a comment-symbol inside (;)', () => {
        const input = `.MyVar = 'h;i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h;i',
                    range: createRange(0, 9, 0, 14)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with double quotes with a comment-symbol inside (;)', () => {
        const input = `.MyVar = "h;i"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h;i',
                    range: createRange(0, 9, 0, 14)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with single quotes with a comment-symbol inside (//)', () => {
        const input = `.MyVar = 'h//i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h//i',
                    range: createRange(0, 9, 0, 15)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with double quotes with a comment-symbol inside (//)', () => {
        const input = `.MyVar = "h//i"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h//i',
                    range: createRange(0, 9, 0, 15)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with an escaped variable delimeter', () => {
        const input = `.MyVar = 'h^$i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h$i',
                    range: createRange(0, 9, 0, 15)
                }
            }
        ]);
    });

    it('should work on assigning a string literal with an escaped escape character', () => {
        const input = `.MyVar = 'h^^i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'string',
                    value: 'h^i',
                    range: createRange(0, 9, 0, 15)
                }
            }
        ]);
    });

    it('should work on assigning a single quoted string with a variable', () => {
        const input = `.MyVar = 'pre-$OtherVar$-post'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        'pre-',
                        {
                            type: 'evaluatedVariable',
                            name: {
                                type: 'string',
                                value: 'OtherVar',
                                range: createRange(0, 15, 0, 23)
                            },
                            scope: 'current',
                            range: createRange(0, 14, 0, 24)
                        },
                        '-post'
                    ],
                    range: createRange(0, 9, 0, 30),
                }
            }
        ]);
    });

    it('should work on assigning a double quoted string with a variable', () => {
        const input = `.MyVar = "pre-$OtherVar$-post"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        'pre-',
                        {
                            type: 'evaluatedVariable',
                            name: {
                                type: 'string',
                                value: 'OtherVar',
                                range: createRange(0, 15, 0, 23)
                            },
                            scope: 'current',
                            range: createRange(0, 14, 0, 24),
                        },
                        '-post'
                    ],
                    range: createRange(0, 9, 0, 30),
                }
            }
        ]);
    });

    it('should work on assigning a string with multiple variables', () => {
        const input = `.MyVar = 'pre-$OtherVar1$-$OtherVar2$-post'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        'pre-',
                        {
                            type: 'evaluatedVariable',
                            name: {
                                type: 'string',
                                value: 'OtherVar1',
                                range: createRange(0, 15, 0, 24)
                            },
                            scope: 'current',
                            range: createRange(0, 14, 0, 25),
                        },
                        '-',
                        {
                            type: 'evaluatedVariable',
                            name: {
                                type: 'string',
                                value: 'OtherVar2',
                                range: createRange(0, 27, 0, 36)
                            },
                            scope: 'current',
                            range: createRange(0, 26, 0, 37),
                        },
                        '-post'
                    ],
                    range: createRange(0, 9, 0, 43),
                }
            }
        ]);
    });

    it('should work on assigning an empty struct', () => {
        const input = `.MyVar = []`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'struct',
                    statements: [],
                    range: createRange(0, 9, 0, 11),
                }
            }
        ]);
    });

    it('should work on assigning an empty struct with the starting brace on the next line', () => {
        const input = `
            .MyVar =
            [
            ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [],
                    range: createRange(2, 12, 3, 13),
                }
            }
        ]);
    });

    it('should work on assigning a struct with a single item', () => {
        const input = `
            .MyVar = [
                .MyBool = true
            ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'MyBool',
                                    range: createRange(2, 17, 2, 23)
                                },
                                scope: 'current',
                                range: createRange(2, 16, 2, 23),
                            },
                            rhs: {
                                type: 'boolean',
                                value: true,
                                range: createRange(2, 26, 2, 30)
                            }
                        }
                    ],
                    range: createRange(1, 21, 3, 13),
                }
            }
        ]);
    });

    it('should work on assigning a struct with multiple items on multiple lines', () => {
        const input = `
            .MyVar = [
                .MyBool = true
                .MyInt = 123
                .MyStr = 'Hello world!'
            ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'MyBool',
                                    range: createRange(2, 17, 2, 23)
                                },
                                scope: 'current',
                                range: createRange(2, 16, 2, 23),
                            },
                            rhs: {
                                type: 'boolean',
                                value: true,
                                range: createRange(2, 26, 2, 30)
                            }
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'MyInt',
                                    range: createRange(3, 17, 3, 22)
                                },
                                scope: 'current',
                                range: createRange(3, 16, 3, 22),
                            },
                            rhs: {
                                type: 'integer',
                                value: 123,
                                range: createRange(3, 25, 3, 28)
                            }
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'MyStr',
                                    range: createRange(4, 17, 4, 22)
                                },
                                scope: 'current',
                                range: createRange(4, 16, 4, 22),
                            },
                            rhs: {
                                type: 'string',
                                value: 'Hello world!',
                                range: createRange(4, 25, 4, 39),
                            }
                        }
                    ],
                    range: createRange(1, 21, 5, 13),
                }
            }
        ]);
    });

    it('should work on assigning a struct with multiple items on a single line', () => {
        const input = `
            .MyVar = [ .MyBool = true .MyInt = 123 ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'MyBool',
                                    range: createRange(1, 24, 1, 30)
                                },
                                scope: 'current',
                                range: createRange(1, 23, 1, 30),
                            },
                            rhs: {
                                type: 'boolean',
                                value: true,
                                range: createRange(1, 33, 1, 37)
                            }
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'MyInt',
                                    range: createRange(1, 39, 1, 44)
                                },
                                scope: 'current',
                                range: createRange(1, 38, 1, 44),
                            },
                            rhs: {
                                type: 'integer',
                                value: 123,
                                range: createRange(1, 47, 1, 50)
                            }
                        },
                    ],
                    range: createRange(1, 21, 1, 52),
                }
            }
        ]);
    });

    it('comments have no affect on a struct', () => {
        const withComments = `
            .MyVar = // Comment 1
            [ // Comment 2
                // Comment 3
                .MyBool = true // Comment 4
                // Comment 5
                // Comment 6
                .MyInt = 123// Comment 7
            ]// Comment 8
            `;
        const withoutComments = `
            .MyVar =
            [

                .MyBool = true


                .MyInt = 123
            ]
            `;
        assertInputsGenerateSameParseResult(withComments, withoutComments);
    });

    it('should error on using commas to separate struct items', () => {
        const input = `.MyVar = [ .A=1, .B=2 ]`;
        const expectedErrorMessage =
`Syntax error: Unexpected item-separator: ",".
| .MyVar = [ .A=1, .B=2 ]
|                ^
Expecting to see one of the following:
 • addition: "+"
 • subtraction: "-"
 • optional-whitespace-and-mandatory-newline (example: "<newline>")
 • Struct-end: "]"
 • whitespace (example: " ")`;
        assertParseSyntaxError(input, expectedErrorMessage, createRange(0, 15, 0, 16));
    });

    it('should work on assigning a struct with one evaluated variable', () => {
        const input = `
            .MyVar = [
                .A = .B
            ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'A',
                                    range: createRange(2, 17, 2, 18)
                                },
                                scope: 'current',
                                range: createRange(2, 16, 2, 18),
                            },
                            rhs: {
                                type: 'evaluatedVariable',
                                name: {
                                    type: 'string',
                                    value: 'B',
                                    range: createRange(2, 22, 2, 23)
                                },
                                scope: 'current',
                                range: createRange(2, 21, 2, 23),
                            }
                        }
                    ],
                    range: createRange(1, 21, 3, 13),
                }
            }
        ]);
    });

    it('should work on assigning a struct with multiple evaluated variables', () => {
        const input = `
            .MyVar = [
                .A = .B
                .C = .D
            ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'A',
                                    range: createRange(2, 17, 2, 18)
                                },
                                scope: 'current',
                                range: createRange(2, 16, 2, 18),
                            },
                            rhs: {
                                type: 'evaluatedVariable',
                                name: {
                                    type: 'string',
                                    value: 'B',
                                    range: createRange(2, 22, 2, 23)
                                },
                                scope: 'current',
                                range: createRange(2, 21, 2, 23),
                            }
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'C',
                                    range: createRange(3, 17, 3, 18)
                                },
                                scope: 'current',
                                range: createRange(3, 16, 3, 18),
                            },
                            rhs: {
                                type: 'evaluatedVariable',
                                name: {
                                    type: 'string',
                                    value: 'D',
                                    range: createRange(3, 22, 3, 23)
                                },
                                scope: 'current',
                                range: createRange(3, 21, 3, 23),
                            }
                        }
                    ],
                    range: createRange(1, 21, 4, 13),
                }
            }
        ]);
    });

    it('should work on assigning the value of another variable', () => {
        const input = `.MyVar = .OtherVar`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'evaluatedVariable',
                    name: {
                        type: 'string',
                        value: 'OtherVar',
                        range: createRange(0, 10, 0, 18)
                    },
                    scope: 'current',
                    range: createRange(0, 9, 0, 18),
                }
            }
        ]);
    });

    it('should work on assigning the value of another variable across multiple lines', () => {
        const input = `
            .MyVar

                =

                .OtherVar
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'evaluatedVariable',
                    name: {
                        type: 'string',
                        value: 'OtherVar',
                        range: createRange(5, 17, 5, 25)
                    },
                    scope: 'current',
                    range: createRange(5, 16, 5, 25),
                }
            }
        ]);
    });

    it('should work on assignment to parent scope', () => {
        const input = `^MyVar = 123`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'parent',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(0, 9, 0, 12)
                }
            }
        ]);
    });

    it('should work on statements with whitespace', () => {
        const input = `
            .MyVar = 123
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(1, 21, 1, 24)
                }
            }
        ]);
    });

    it('should work on statements with comments on different lines', () => {
        const input = `
            // Comment 1
            .MyVar = 123
            // Comment 2
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(2, 13, 2, 18)
                    },
                    scope: 'current',
                    range: createRange(2, 12, 2, 18),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(2, 21, 2, 24)
                }
            }
        ]);
    });

    it('should work on statements with comments on the same line', () => {
        const input = `.MyVar = 123  // Comment`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(0, 9, 0, 12)
                }
            }
        ]);
    });

    it('should work on statements with comments on the same with no spaces between', () => {
        const input = `.MyVar = 123// Comment`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'integer',
                    value: 123,
                    range: createRange(0, 9, 0, 12)
                }
            }
        ]);
    });

    it('should work on multiple statements with whitespace', () => {
        const input = `
            .MyVar1 = 1



            .MyVar2 = 2
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar1',
                        range: createRange(1, 13, 1, 19)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 19),
                },
                rhs: {
                    type: 'integer',
                    value: 1,
                    range: createRange(1, 22, 1, 23)
                }
            },
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar2',
                        range: createRange(5, 13, 5, 19)
                    },
                    scope: 'current',
                    range: createRange(5, 12, 5, 19),
                },
                rhs: {
                    type: 'integer',
                    value: 2,
                    range: createRange(5, 22, 5, 23)
                }
            }
        ]);
    });

    it('should work on an empty scope on the same line', () => {
        const input = `{}`;
        assertParseResultsEqual(input, [
            {
                type: 'scopedStatements',
                statements: [],
            }
        ]);
    });

    it('should work on an empty scope on different lines', () => {
        const input = `
            {
            }
        `;
        assertParseResultsEqual(input, [
            {
                type: 'scopedStatements',
                statements: [],
            }
        ]);
    });

    it('should work on a scope with a statement', () => {
        const input = `
            {
                .MyVar = 123
            }
        `;
        assertParseResultsEqual(input, [
            {
                type: 'scopedStatements',
                statements: [
                    {
                        type: 'variableDefinition',
                        lhs: {
                            name: {
                                type: 'string',
                                value: 'MyVar',
                                range: createRange(2, 17, 2, 22)
                            },
                            scope: 'current',
                            range: createRange(2, 16, 2, 22),
                        },
                        rhs: {
                            type: 'integer',
                            value: 123,
                            range: createRange(2, 25, 2, 28)
                        }
                    }
                ],
            }
        ]);
    });

    it('should work on a scope with a statement on the same line', () => {
        const input = `
            { .MyVar = 123 }
        `;
        assertParseResultsEqual(input, [
            {
                type: 'scopedStatements',
                statements: [
                    {
                        type: 'variableDefinition',
                        lhs: {
                            name: {
                                type: 'string',
                                value: 'MyVar',
                                range: createRange(1, 15, 1, 20)
                            },
                            scope: 'current',
                            range: createRange(1, 14, 1, 20),
                        },
                        rhs: {
                            type: 'integer',
                            value: 123,
                            range: createRange(1, 23, 1, 26)
                        }
                    }
                ],
            }
        ]);
    });

    it('should work on adding a string literal', () => {
        const input = `
            .MyMessage = 'hello'
            .MyMessage + ' world'
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(1, 13, 1, 22)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: {
                    type: 'string',
                    value: 'hello',
                    range: createRange(1, 25, 1, 32)
                }
            },
            {
                type: 'binaryOperator',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(2, 13, 2, 22)
                    },
                    scope: 'current',
                    range: createRange(2, 12, 2, 22),
                },
                rhs: {
                    type: 'string',
                    value: ' world',
                    range: createRange(2, 25, 2, 33)
                },
                operator: '+',
            }
        ]);
    });

    it('comments have no affect when adding string literals', () => {
        const withComments = `
            .MyMessage = 'hello' + // Comment 1
                         // Comment 2
                         ' world'
        `;
        const withoutComments = `
            .MyMessage = 'hello' +

                         ' world'
        `;
        assertInputsGenerateSameParseResult(withComments, withoutComments);
    });

    it('comments have no affect when adding string literals (+ on different line)', () => {
        const withComments = `
            .MyMessage = 'hello' // Comment 1
                         // Comment 2
                         + ' world'
        `;
        const withoutComments = `
            .MyMessage = 'hello'

                         + ' world'
        `;
        assertInputsGenerateSameParseResult(withComments, withoutComments);
    });

    it('should work on adding a string literal to a variable in the parent scope', () => {
        const input = `
            .MyMessage = 'hello'
            {
                ^MyMessage + ' world'
            }
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(1, 13, 1, 22)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: {
                    type: 'string',
                    value: 'hello',
                    range: createRange(1, 25, 1, 32)
                }
            },
            {
                type: 'scopedStatements',
                statements: [
                    {
                        type: 'binaryOperator',
                        lhs: {
                            name: {
                                type: 'string',
                                value: 'MyMessage',
                                range: createRange(3, 17, 3, 26)
                            },
                            scope: 'parent',
                            range: createRange(3, 16, 3, 26),
                        },
                        rhs: {
                            type: 'string',
                            value: ' world',
                            range: createRange(3, 29, 3, 37)
                        },
                        operator: '+',
                    }
                ],
            },
        ]);
    });

    it('should work on adding a string with a variable', () => {
        const input = `
            .MyName = 'Bobo'
            .MyMessage = 'hello'
            .MyMessage + ' $MyName$'
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyName',
                        range: createRange(1, 13, 1, 19)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 19),
                },
                rhs: {
                    type: 'string',
                    value: 'Bobo',
                    range: createRange(1, 22, 1, 28)
                }
            },
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(2, 13, 2, 22)
                    },
                    scope: 'current',
                    range: createRange(2, 12, 2, 22),
                },
                rhs: {
                    type: 'string',
                    value: 'hello',
                    range: createRange(2, 25, 2, 32)
                }
            },
            {
                type: 'binaryOperator',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(3, 13, 3, 22)
                    },
                    scope: 'current',
                    range: createRange(3, 12, 3, 22),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        ' ',
                        {
                            type: 'evaluatedVariable',
                            name: {
                                type: 'string',
                                value: 'MyName',
                                range: createRange(3, 28, 3, 34)
                            },
                            scope: 'current',
                            range: createRange(3, 27, 3, 35),
                        }
                    ],
                    range: createRange(3, 25, 3, 36),
                },
                operator: '+',
            }
        ]);
    });

    it('adding a string literal should use the last referenced variable if none is specified', () => {
        const input = `
            .MyMessage = 'hello'
                       + ' world'
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(1, 13, 1, 22)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: {
                    type: 'string',
                    value: 'hello',
                    range: createRange(1, 25, 1, 32)
                },
            },
            {
                type: 'binaryOperatorOnUnnamed',
                operator: '+',
                rhs: {
                    type: 'string',
                    value: ' world',
                    range: createRange(2, 25, 2, 33)
                },
                rangeStart: createPosition(2, 23)
            }
        ]);
    });

    it('adding a string literal on the same line should use the last referenced variable', () => {
        const input = `.MyMessage = 'hello' + ' world'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(0, 1, 0, 10)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 10),
                },
                rhs: {
                    type: 'sum',
                    first: {
                        type: 'string',
                        value: 'hello',
                        range: createRange(0, 13, 0, 20)
                    },
                    summands: [
                        {
                            operator: '+',
                            value: {
                                type: 'string',
                                value: ' world',
                                range: createRange(0, 23, 0, 31)
                            }
                        }
                    ],
                }
            }
        ]);
    });

    it('adding mulitple string literals should use the last referenced variable if none is specified', () => {
        const input = `
            .MyMessage = 'hello'
                       + ' world'
                       + '!'
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(1, 13, 1, 22)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: {
                    type: 'string',
                    value: 'hello',
                    range: createRange(1, 25, 1, 32)
                }
            },
            {
                type: 'binaryOperatorOnUnnamed',
                operator: '+',
                rhs: {
                    type: 'string',
                    value: ' world',
                    range: createRange(2, 25, 2, 33)
                },
                rangeStart: createPosition(2, 23)
            },
            {
                type: 'binaryOperatorOnUnnamed',
                operator: '+',
                rhs: {
                    type: 'string',
                    value: '!',
                    range: createRange(3, 25, 3, 28)
                },
                rangeStart: createPosition(3, 23)
            },
        ]);
    });

    it('adding mulitple string literals on the same line should use the last referenced variable', () => {
        const input = `.MyVar = 'hello' + ' world'+'!'
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'sum',
                    first: {
                        type: 'string',
                        value: 'hello',
                        range: createRange(0, 9, 0, 16)
                    },
                    summands: [
                        {
                            operator: '+',
                            value: {
                                type: 'string',
                                value: ' world',
                                range: createRange(0, 19, 0, 27)
                            }
                        },
                        {
                            operator: '+',
                            value: {
                                type: 'string',
                                value: '!',
                                range: createRange(0, 28, 0, 31)
                            }
                        },
                    ],
                }
            }
        ]);
    });

    it('adding and subtracting mulitple string literals should use the last referenced variable if none is specified', () => {
        const input = `
            .MyMessage = 'hello world!'
                       - ' world'
                       - '!'
                       + '?'
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(1, 13, 1, 22)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: {
                    type: 'string',
                    value: 'hello world!',
                    range: createRange(1, 25, 1, 39)
                }
            },
            {
                type: 'binaryOperatorOnUnnamed',
                operator: '-',
                rhs: {
                    type: 'string',
                    value: ' world',
                    range: createRange(2, 25, 2, 33)
                },
                rangeStart: createPosition(2, 23)
            },
            {
                type: 'binaryOperatorOnUnnamed',
                operator: '-',
                rhs: {
                    type: 'string',
                    value: '!',
                    range: createRange(3, 25, 3, 28)
                },
                rangeStart: createPosition(3, 23)
            },
            {
                type: 'binaryOperatorOnUnnamed',
                operator: '+',
                rhs: {
                    type: 'string',
                    value: '?',
                    range: createRange(4, 25, 4, 28)
                },
                rangeStart: createPosition(4, 23)
            },
        ]);
    });

    it('adding an evaluated variable should use the last referenced variable if none is specified', () => {
        const input = `.MyMessage = 'hello ' + .MyVar`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(0, 1, 0, 10)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 10),
                },
                rhs: {
                    type: 'sum',
                    first: {
                        type: 'string',
                        value: 'hello ',
                        range: createRange(0, 13, 0, 21)
                    },
                    summands: [
                        {
                            operator: '+',
                            value: {
                                type: 'evaluatedVariable',
                                name: {
                                    type: 'string',
                                    value: 'MyVar',
                                    range: createRange(0, 25, 0, 30)
                                },
                                scope: 'current',
                                range: createRange(0, 24, 0, 30),
                            }
                        },
                    ],
                }
            }
        ]);
    });

    it('adding multiple evaluated variables should use the last referenced variable if none is specified', () => {
        const input = `.MyMessage = 'hello ' + .MyVar1 + .MyVar2`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyMessage',
                        range: createRange(0, 1, 0, 10)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 10),
                },
                rhs: {
                    type: 'sum',
                    first: {
                        type: 'string',
                        value: 'hello ',
                        range: createRange(0, 13, 0, 21)
                    },
                    summands: [
                        {
                            operator: '+',
                            value: {
                                type: 'evaluatedVariable',
                                name: {
                                    type: 'string',
                                    value: 'MyVar1',
                                    range: createRange(0, 25, 0, 31)
                                },
                                scope: 'current',
                                range: createRange(0, 24, 0, 31),
                            }
                        },
                        {
                            operator: '+',
                            value: {
                                type: 'evaluatedVariable',
                                name: {
                                    type: 'string',
                                    value: 'MyVar2',
                                    range: createRange(0, 35, 0, 41)
                                },
                                scope: 'current',
                                range: createRange(0, 34, 0, 41),
                            }
                        },
                    ],
                }
            }
        ]);
    });

    it('comments have no affect when adding evaluated variables', () => {
        const withComments = `
                .MyMessage = 'hello ' // Comment 1
                                      // Comment 2
                           + .MyVar1  // Comment 3
                                      // Comment 4
                                      // Comment 5
                           + .MyVar2
                                      // Comment 6
                                      // Comment 7
        `;
        const withoutComments = `
                .MyMessage = 'hello '

                           + .MyVar1


                           + .MyVar2
        `;
        assertInputsGenerateSameParseResult(withComments, withoutComments);
    });

    it('should work on assigning an empty array', () => {
        const input = `.MyVar = {}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'array',
                    value: [],
                    range: createRange(0, 9, 0, 11)
                }
            }
        ]);
    });

    it('should work on assigning an empty array with whitespace', () => {
        const input = `.MyVar = { }`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'array',
                    value: [],
                    range: createRange(0, 9, 0, 12)
                }
            }
        ]);
    });

    it('should work on assigning an array of 1 integer', () => {
        const input = `.MyVar = {1}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'integer',
                            value: 1,
                            range: createRange(0, 10, 0, 11)
                        }
                    ],
                    range: createRange(0, 9, 0, 12)
                }
            }
        ]);
    });

    it('should work on assigning an array of 1 integer with whitespace', () => {
        const input = `
            .MyVar = {
                        1 }
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'integer',
                            value: 1,
                            range: createRange(2, 24, 2, 25)
                        }
                    ],
                    range: createRange(1, 21, 2, 27)
                }
            }
        ]);
    });

    it('should work on assigning an array of integers', () => {
        const input = `
            .MyVar = {
                1
                100
            }`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'integer',
                            value: 1,
                            range: createRange(2, 16, 2, 17)
                        },
                        {
                            type: 'integer',
                            value: 100,
                            range: createRange(3, 16, 3, 19)
                        }
                    ],
                    range: createRange(1, 21, 4, 13)
                }
            }
        ]);
    });

    it('should work on assigning an array of integers on the same line with commas', () => {
        const input = `.MyVar = {1,2,3}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'integer',
                            value: 1,
                            range: createRange(0, 10, 0, 11)
                        },
                        {
                            type: 'integer',
                            value: 2,
                            range: createRange(0, 12, 0, 13)
                        },
                        {
                            type: 'integer',
                            value: 3,
                            range: createRange(0, 14, 0, 15)
                        }
                    ],
                    range: createRange(0, 9, 0, 16)
                }
            }
        ]);
    });

    it('should work on assigning an array of integers with whitespace', () => {
        const input = `
            .MyVar = {1 , 2
                        3}
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'integer',
                            value: 1,
                            range: createRange(1, 22, 1, 23)
                        },
                        {
                            type: 'integer',
                            value: 2,
                            range: createRange(1, 26, 1, 27)
                        },
                        {
                            type: 'integer',
                            value: 3,
                            range: createRange(2, 24, 2, 25)
                        }
                    ],
                    range: createRange(1, 21, 2, 26)
                }
            }
        ]);
    });

    it('should work on assigning an array of strings', () => {
        const input = `.MyVar = {'str1', 'str2'}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'string',
                            value: 'str1',
                            range: createRange(0, 10, 0, 16)
                        },
                        {
                            type: 'string',
                            value: 'str2',
                            range: createRange(0, 18, 0, 24)
                        }
                    ],
                    range: createRange(0, 9, 0, 25)
                }
            }
        ]);
    });

    it('should work on assigning an array of booleans', () => {
        const input = `.MyVar = {true, false}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'boolean',
                            value: true,
                            range: createRange(0, 10, 0, 14)
                        },
                        {
                            type: 'boolean',
                            value: false,
                            range: createRange(0, 16, 0, 21)
                        }
                    ],
                    range: createRange(0, 9, 0, 22)
                }
            }
        ]);
    });

    it('should work on assigning an array of evaluated variables', () => {
        const input = `.MyVar = {.A, .B}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(0, 1, 0, 6)
                    },
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'evaluatedVariable',
                            name: {
                                type: 'string',
                                value: 'A',
                                range: createRange(0, 11, 0, 12)
                            },
                            scope: 'current',
                            range: createRange(0, 10, 0, 12),
                        },
                        {
                            type: 'evaluatedVariable',
                            name: {
                                type: 'string',
                                value: 'B',
                                range: createRange(0, 15, 0, 16)
                            },
                            scope: 'current',
                            range: createRange(0, 14, 0, 16),
                        }
                    ],
                    range: createRange(0, 9, 0, 17)
                }
            }
        ]);
    });

    it('comments have no affect in an empty array', () => {
        const withComments = `
            .MyVar = {// Comment 1
                // Comment 2
                // Comment 3
            } // Comment 4
        `;
        const withoutComments = `
            .MyVar = {


            }
        `;
        assertInputsGenerateSameParseResult(withComments, withoutComments);
    });

    it('comments have no affect in a non-empty array', () => {
        const withComments = `
            .MyVar = // Comment 1
            { // Comment 2
                'str1' // Comment 3
                // Comment 4
                //Comment 5
                'str2'// Comment 6
            } //Comment 7
            `;
        const withoutComments = `
            .MyVar =
            {
                'str1'


                'str2'
            }
            `;
        assertInputsGenerateSameParseResult(withComments, withoutComments);
    });

    it('should work on adding an array', () => {
        const input = `
            .MyVar + {'cow'}
        `;
        assertParseResultsEqual(input, [
            {
                type: 'binaryOperator',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'string',
                            value: 'cow',
                            range: createRange(1, 22, 1, 27)
                        }
                    ],
                    range: createRange(1, 21, 1, 28)
                },
                operator: '+',
            }
        ]);
    });

    it('should work on adding an array with an evaluated variable', () => {
        const input = `
            .MyVar + {.B, 'c'}
        `;
        assertParseResultsEqual(input, [
            {
                type: 'binaryOperator',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'array',
                    value: [
                        {
                            type: 'evaluatedVariable',
                            name: {
                                type: 'string',
                                value: 'B',
                                range: createRange(1, 23, 1, 24)
                            },
                            scope: 'current',
                            range: createRange(1, 22, 1, 24),
                        },
                        {
                            type: 'string',
                            value: 'c',
                            range: createRange(1, 26, 1, 29)
                        }
                    ],
                    range: createRange(1, 21, 1, 30)
                },
                operator: '+',
            }
        ]);
    });

    it('should work on inline adding an array with an evaluated variable', () => {
        const input = `
            .MyVar = {'a'} + { .B , 'c'}
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: {
                        type: 'string',
                        value: 'MyVar',
                        range: createRange(1, 13, 1, 18)
                    },
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'sum',
                    first: {
                        type: 'array',
                        value: [
                            {
                                type: 'string',
                                value: 'a',
                                range: createRange(1, 22, 1, 25)
                            }
                        ],
                        range: createRange(1, 21, 1, 26)
                    },
                    summands: [
                        {
                            operator: '+',
                            value: {
                                type: 'array',
                                value: [
                                    {
                                        type: 'evaluatedVariable',
                                        name: {
                                            type: 'string',
                                            value: 'B',
                                            range: createRange(1, 32, 1, 33)
                                        },
                                        scope: 'current',
                                        range: createRange(1, 31, 1, 33),
                                    },
                                    {
                                        type: 'string',
                                        value: 'c',
                                        range: createRange(1, 36, 1, 39)
                                    }
                                ],
                                range: createRange(1, 29, 1, 40)
                            }
                        },
                    ],
                }
            }
        ]);
    });

    describe('Using', () => {
        it('Call Using outside a struct', () => {
            const input = `
                .MyVar = [
                    .MyBool = true
                ]
                Using(.MyVar)
            `;
            assertParseResultsEqual(input, [
                {
                    type: 'variableDefinition',
                    lhs: {
                        name: {
                            type: 'string',
                            value: 'MyVar',
                            range: createRange(1, 17, 1, 22)
                        },
                        scope: 'current',
                        range: createRange(1, 16, 1, 22),
                    },
                    rhs: {
                        type: 'struct',
                        statements: [
                            {
                                type: 'variableDefinition',
                                lhs: {
                                    name: {
                                        type: 'string',
                                        value: 'MyBool',
                                        range: createRange(2, 21, 2, 27)
                                    },
                                    scope: 'current',
                                    range: createRange(2, 20, 2, 27),
                                },
                                rhs: {
                                    type: 'boolean',
                                    value: true,
                                    range: createRange(2, 30, 2, 34)
                                }
                            }
                        ],
                        range: createRange(1, 25, 3, 17),
                    }
                },
                {
                    type: 'using',
                    struct: {
                        type: 'evaluatedVariable',
                        name: {
                            type: 'string',
                            value: 'MyVar',
                            range: createRange(4, 23, 4, 28)
                        },
                        scope: 'current',
                        range: createRange(4, 22, 4, 28),
                    },
                    range: createRange(4, 16, 4, 29),
                }
            ]);
        });

        it('Call Using, with whitespace, outside a struct', () => {
            const input = `
                .MyVar = [
                    .MyBool = true
                ]
                Using  (  .MyVar  )
            `;
            assertParseResultsEqual(input, [
                {
                    type: 'variableDefinition',
                    lhs: {
                        name: {
                            type: 'string',
                            value: 'MyVar',
                            range: createRange(1, 17, 1, 22)
                        },
                        scope: 'current',
                        range: createRange(1, 16, 1, 22),
                    },
                    rhs: {
                        type: 'struct',
                        statements: [
                            {
                                type: 'variableDefinition',
                                lhs: {
                                    name: {
                                        type: 'string',
                                        value: 'MyBool',
                                        range: createRange(2, 21, 2, 27)
                                    },
                                    scope: 'current',
                                    range: createRange(2, 20, 2, 27),
                                },
                                rhs: {
                                    type: 'boolean',
                                    value: true,
                                    range: createRange(2, 30, 2, 34)
                                }
                            }
                        ],
                        range: createRange(1, 25, 3, 17),
                    }
                },
                {
                    type: 'using',
                    struct: {
                        type: 'evaluatedVariable',
                        name: {
                            type: 'string',
                            value: 'MyVar',
                            range: createRange(4, 27, 4, 32)
                        },
                        scope: 'current',
                        range: createRange(4, 26, 4, 32),
                    },
                    range: createRange(4, 16, 4, 35),
                }
            ]);
        });

        it('Call Using inside a struct', () => {
            const input = `
                .MyVar = [
                    .MyBool = true
                ]
                .Other = [
                    Using(.MyVar)
                ]
            `;
            assertParseResultsEqual(input, [
                {
                    type: 'variableDefinition',
                    lhs: {
                        name: {
                            type: 'string',
                            value: 'MyVar',
                            range: createRange(1, 17, 1, 22)
                        },
                        scope: 'current',
                        range: createRange(1, 16, 1, 22),
                    },
                    rhs: {
                        type: 'struct',
                        statements: [
                            {
                                type: 'variableDefinition',
                                lhs: {
                                    name: {
                                        type: 'string',
                                        value: 'MyBool',
                                        range: createRange(2, 21, 2, 27)
                                    },
                                    scope: 'current',
                                    range: createRange(2, 20, 2, 27),
                                },
                                rhs: {
                                    type: 'boolean',
                                    value: true,
                                    range: createRange(2, 30, 2, 34)
                                }
                            }
                        ],
                        range: createRange(1, 25, 3, 17),
                    }
                },
                {
                    type: 'variableDefinition',
                    lhs: {
                        name: {
                            type: 'string',
                            value: 'Other',
                            range: createRange(4, 17, 4, 22)
                        },
                        scope: 'current',
                        range: createRange(4, 16, 4, 22),
                    },
                    rhs: {
                        type: 'struct',
                        statements: [
                            {
                                type: 'using',
                                struct: {
                                    type: 'evaluatedVariable',
                                    name: {
                                        type: 'string',
                                        value: 'MyVar',
                                        range: createRange(5, 27, 5, 32)
                                    },
                                    scope: 'current',
                                    range: createRange(5, 26, 5, 32),
                                },
                                range: createRange(5, 20, 5, 33),
                            }
                        ],
                        range: createRange(4, 25, 6, 17),
                    }
                }
            ]);
        });
    });

    describe('ForEach', () => {
        it('comments have no affect in a non-empty array', () => {
            const withComments = `
                ForEach( .Item in .MyArray ) // Comment 1
                { // Comment 2
                    .Copy1 = .Item
                    // Comment 3
                    // Comment 4
                    .Copy2 = .Item
                } // Comment 5
            `;
            const withoutComments = `
                ForEach( .Item in .MyArray )
                {
                    .Copy1 = .Item


                    .Copy2 = .Item
                }
            `;
            assertInputsGenerateSameParseResult(withComments, withoutComments);
        });
    });

    describe('If', () => {
        describe('Boolean expression', () => {
            it('comments have no affect', () => {
                const withComments = `
                    If( .Value ) // Comment 1
                    { // Comment 2
                        // Comment 3
                        // Comment 4
                        ^Result = true
                        // Comment 5
                    } // Comment 6
                `;
                const withoutComments = `
                    If( .Value ) //
                    {


                        ^Result = true

                    }
                `;
                assertInputsGenerateSameParseResult(withComments, withoutComments);
            });
        });

        describe('Compound expression', () => {
            it('should error on a comparison compound expression without parenthesis around the terms (comparison 1st)', () => {
                const input = `
                    If( .Cat == 'cat' && .Bool )
                    {
                    }
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected operator-and: "&&".
| If( .Cat == 'cat' && .Bool )
|                   ^^
Expecting to see the following:
 • function-parameters-end: ")"`;
                assertParseSyntaxError(input, expectedErrorMessage, createRange(1, 38, 1, 39));
            });

            it('should error on a comparison compound expression without parenthesis around the terms (comparison 2nd)', () => {
                const input = `
                    If( .Bool && .Cat == 'cat' )
                    {
                    }
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected operator-equal: "==".
| If( .Bool && .Cat == 'cat' )
|                   ^^
Expecting to see one of the following:
 • function-parameters-end: ")"
 • operator-and: "&&"
 • operator-or: "||"`;
                assertParseSyntaxError(input, expectedErrorMessage, createRange(1, 38, 1, 39));
            });

            it('should error on a presence-in-ArrayOfStrings compound expression without parenthesis around the terms (presence-in-ArrayOfStrings 1st)', () => {
                const input = `
                    If( .Needle in .Haystack || .Bool )
                    {
                    }
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected operator-or: "||".
| If( .Needle in .Haystack || .Bool )
|                          ^^
Expecting to see the following:
 • function-parameters-end: ")"`;
                assertParseSyntaxError(input, expectedErrorMessage, createRange(1, 45, 1, 46));
            });

            it('should error on a presence-in-ArrayOfStrings compound expression without parenthesis around the terms (presence-in-ArrayOfStrings 2nd)', () => {
                const input = `
                    If( .Bool || .Needle in .Haystack )
                    {
                    }
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected keyword-in: "in".
| If( .Bool || .Needle in .Haystack )
|                      ^^
Expecting to see one of the following:
 • function-parameters-end: ")"
 • operator-and: "&&"
 • operator-or: "||"`;
                assertParseSyntaxError(input, expectedErrorMessage, createRange(1, 41, 1, 42));
            });
        });
    });

    describe('Generic functions', () => {
        const genericFunctionNames = [
            'Alias',
            'Compiler',
            'Copy',
            'CopyDir',
            'CSAssembly',
            'DLL',
            'Exec',
            'Executable',
            'Library',
            'ListDependencies',
            'ObjectList',
            'RemoveDir',
            'Test',
            'TextFile',
            'Unity',
            'VCXProject',
            'VSProjectExternal',
            'VSSolution',
            'XCodeProject',
        ];

        for (const functionName of genericFunctionNames) {
            describe(functionName, () => {
                it('comments have no affect', () => {
                    const withComments = `
                        ${functionName}('MyAliasName') // Comment 1
                        { //Comment 2
                            // Comment 3
                            //Comment 4
                        } // Comment 5
                    `;
                    const withoutComments = `
                        ${functionName}('MyAliasName')
                        {


                        }
                    `;
                    assertInputsGenerateSameParseResult(withComments, withoutComments);
                });
            });
        }
    });

    describe('User function', () => {
        it('Declare function with arguments', () => {
            const input = `
                function Func( .Arg1, .Arg2 ){
                }
            `;
            assertParseResultsEqual(input, [
                {
                    type: 'userFunctionDeclaration',
                    name: 'Func',
                    nameRange: createRange(1, 25, 1, 29),
                    parameters: [
                        {
                            type: 'userFunctionDeclarationParameter',
                            name: 'Arg1',
                            range: createRange(1, 31, 1, 36),
                        },
                        {
                            type: 'userFunctionDeclarationParameter',
                            name: 'Arg2',
                            range: createRange(1, 38, 1, 43),
                        },
                    ],
                    statements: [],
                }
            ]);
        });
    });

    describe('Settings', () => {
        it('comments have no affect', () => {
            const withComments = `
                Settings // Comment 1
                { // Comment 2
                    // Comment 3
                    .Copy = .Value
                    //Comment 4
                    // Comment 5
                } // Comment 6
            `;
            const withoutComments = `
                Settings
                {

                    .Copy = .Value


                }
            `;
            assertInputsGenerateSameParseResult(withComments, withoutComments);
        });
    });

    describe('adding/subtracting to an existing value', () => {
        for (const operator of ['+', '-']) {
            describe(operator, () => {
                // This will parse but will fail to evaluate, since there's no existing value.
                it('Simple (1)', () => {
                    const input = `
                        ${operator} 1
                    `;
                    assertParseResultsEqual(input, [
                        {
                            type: 'binaryOperatorOnUnnamed',
                            operator,
                            rhs: {
                                type: 'integer',
                                value: 1,
                                range: createRange(1, 26, 1, 27)
                            },
                            rangeStart: createPosition(1, 24)
                        }
                    ]);
                });

                // This will parse but will fail to evaluate, since there's no existing value.
                it('Simple (2)', () => {
                    const input = `
                        Print('hi')
                        ${operator} 1
                    `;
                    assertParseResultsEqual(input, [
                        {
                            type: 'print',
                            value: {
                                type: 'string',
                                value: 'hi',
                                range: createRange(1, 30, 1, 34)
                            },
                            range: createRange(1, 24, 1, 35)
                        },
                        {
                            type: 'binaryOperatorOnUnnamed',
                            operator,
                            rhs: {
                                type: 'integer',
                                value: 1,
                                range: createRange(2, 26, 2, 27)
                            },
                            rangeStart: createPosition(2, 24)
                        }
                    ]);
                });

                it('#if', () => {
                    const input = `
                        .MyStr
                            = '1'
                        #if __WINDOWS__
                            ${operator} ' 2'
                        #else
                            ${operator} ' 3'
                        #endif
                    `;
                    assertParseResultsEqual(input, [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: {
                                    type: 'string',
                                    value: 'MyStr',
                                    range: createRange(1, 25, 1, 30)
                                },
                                scope: 'current',
                                range: createRange(1, 24, 1, 30)
                            },
                            rhs: {
                                type: 'string',
                                value: '1',
                                range: createRange(2, 30, 2, 33)
                            }
                        },
                        {
                            type: 'directiveIf',
                            condition: [
                                [
                                    {
                                        invert: false,
                                        term: {
                                            type: 'isSymbolDefined',
                                            symbol: '__WINDOWS__'
                                        }
                                    }
                                ]
                            ],
                            ifStatements: [
                                {
                                    type: 'binaryOperatorOnUnnamed',
                                    operator,
                                    rhs: {
                                        type: 'string',
                                        value: ' 2',
                                        range: createRange(4, 30, 4, 34)
                                    },
                                    rangeStart: createPosition(4, 28)
                                }
                            ],
                            elseStatements: [
                                {
                                    type: 'binaryOperatorOnUnnamed',
                                    operator,
                                    rhs: {
                                        type: 'string',
                                        value: ' 3',
                                        range: createRange(6, 30, 6, 34)
                                    },
                                    rangeStart: createPosition(6, 28)
                                }
                            ],
                            rangeStart: createPosition(3, 24)
                        }
                    ]);
                });
            });
        }
    });

    describe('#if', () => {
        it('comments have no affect', () => {
            const withComments = `
                #if __WINDOWS__ // Comment 1
                    // Comment 2
                    //Comment 3
                    .Value = 'if' // Comment 4
                #else // Comment 5
                    //Comment 6
                    // Comment 7
                    .Value = 'else' // Comment 8
                    //Comment 9
                    // Comment 10
                #endif// Comment 5
            `;
            const withoutComments = `
                #if __WINDOWS__


                    .Value = 'if'
                #else


                    .Value = 'else'


                #endif
            `;
            assertInputsGenerateSameParseResult(withComments, withoutComments);
        });
    });
});