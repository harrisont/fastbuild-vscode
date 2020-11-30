import * as assert from 'assert';

import {
    parse,
    SourceRange,
} from '../parser';

function createRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): SourceRange {
    return {
        start: {
            line: startLine,
            character: startCharacter
        },
        end: {
            line: endLine,
            character: endCharacter
        }
    };
}

function assertParseResultsEqual(input: string, expectedResult: any[]): void {
    const result = parse(input);
    assert.deepStrictEqual(result, expectedResult);
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 123
            }
        ]);
    });

    it('should work on assignment with no spaces', () => {
        const input = `.MyVar=123`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 123
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: 123
            }
        ]);
    });

    it('should work on assigning true', () => {
        const input = `.MyVar = true`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: true
            }
        ]);
    });

    it('should work on assigning false', () => {
        const input = `.MyVar = false`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: false
            }
        ]);
    });

    it('should work on assigning an empty string literal', () => {
        const input = `.MyVar = ''`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: ''
            }
        ]);
    });

    it('should work on assigning a string literal with single quotes', () => {
        const input = `.MyVar = 'hi'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 'hi'
            }
        ]);
    });

    it('should work on assigning a string literal with double quotes', () => {
        const input = `.MyVar = "hi"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 'hi'
            }
        ]);
    });

    it('should work on assigning a string literal with single quotes with a double quote inside', () => {
        const input = `.MyVar = 'h"i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 'h"i'
            }
        ]);
    });

    it('should work on assigning a string literal with double quotes with a single quote inside', () => {
        const input = `.MyVar = "h'i"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 'h\'i'
            }
        ]);
    });

    it('should work on assigning a string literal with single quotes with an escaped single quote inside', () => {
        const input = `.MyVar = 'h^'i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: "h'i"
            }
        ]);
    });

    it('should work on assigning a string literal with double quotes with an escaped double quote inside', () => {
        const input = `.MyVar = "h^"i"`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 'h"i'
            }
        ]);
    });

    it('should work on assigning a string literal with an escaped variable delimeter', () => {
        const input = `.MyVar = 'h^$i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: "h$i"
            }
        ]);
    });

    it('should work on assigning a string literal with an escaped escape character', () => {
        const input = `.MyVar = 'h^^i'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: "h^i"
            }
        ]);
    });

    it('should work on assigning a single quoted string with a variable', () => {
        const input = `.MyVar = 'pre-$OtherVar$-post'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        'pre-',
                        {
                            type: 'evaluatedVariable',
                            name: 'OtherVar',
                            scope: 'current',
                            range: createRange(0, 14, 0, 24)
                        },
                        '-post'
                    ]
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        'pre-',
                        {
                            type: 'evaluatedVariable',
                            name: 'OtherVar',
                            scope: 'current',
                            range: createRange(0, 14, 0, 24),
                        },
                        '-post'
                    ]
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        'pre-',
                        {
                            type: 'evaluatedVariable',
                            name: 'OtherVar1',
                            scope: 'current',
                            range: createRange(0, 14, 0, 25),
                        },
                        '-',
                        {
                            type: 'evaluatedVariable',
                            name: 'OtherVar2',
                            scope: 'current',
                            range: createRange(0, 26, 0, 37),
                        },
                        '-post'
                    ]
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'struct',
                    statements: [],
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyBool',
                                scope: 'current',
                                range: createRange(2, 16, 2, 23),
                            },
                            rhs: true
                        }
                    ],
                }
            }
        ]);
    });

    it('should work on assigning a struct with multiple items', () => {
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyBool',
                                scope: 'current',
                                range: createRange(2, 16, 2, 23),
                            },
                            rhs: true
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyInt',
                                scope: 'current',
                                range: createRange(3, 16, 3, 22),
                            },
                            rhs: 123
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyStr',
                                scope: 'current',
                                range: createRange(4, 16, 4, 22),
                            },
                            rhs: 'Hello world!'
                        }
                    ],
                }
            }
        ]);
    });

    it('should work on assigning a struct with commas', () => {
        const input = `
            .MyVar = [
                .MyBool = true,
                .MyInt = 123,
                .MyStr = 'Hello world!'
            ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyBool',
                                scope: 'current',
                                range: createRange(2, 16, 2, 23),
                            },
                            rhs: true
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyInt',
                                scope: 'current',
                                range: createRange(3, 16, 3, 22),
                            },
                            rhs: 123
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyStr',
                                scope: 'current',
                                range: createRange(4, 16, 4, 22),
                            },
                            rhs: 'Hello world!'
                        },
                    ],
                }
            }
        ]);
    });

    it('should work on assigning a struct with comments', () => {
        const input = `
            .MyVar = [
                // Comment 1
                .MyBool = true
                // Comment 2
                .MyInt = 123
            ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyBool',
                                scope: 'current',
                                range: createRange(3, 16, 3, 23),
                            },
                            rhs: true
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyInt',
                                scope: 'current',
                                range: createRange(5, 16, 5, 22),
                            },
                            rhs: 123
                        }
                    ],
                }
            }
        ]);
    });

    it('should work on assigning a struct with a single item with a trailing comma', () => {
        const input = `
            .MyVar = [
                .MyBool = true,
            ]
            `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'MyBool',
                                scope: 'current',
                                range: createRange(2, 16, 2, 23),
                            },
                            rhs: true
                        }
                    ],
                }
            }
        ]);
    });

    it('should work on assigning a struct on a single line with commas', () => {
        const input = `.MyVar = [.A=1, .B=2]`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'A',
                                scope: 'current',
                                range: createRange(0, 10, 0, 12),
                            },
                            rhs: 1
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'B',
                                scope: 'current',
                                range: createRange(0, 16, 0, 18),
                            },
                            rhs: 2
                        }
                    ],
                }
            }
        ]);
    });

    it('should work on assigning a struct with one evaluated variable', () => {
        const input = `.MyVar = [.A=.B]`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'A',
                                scope: 'current',
                                range: createRange(0, 10, 0, 12),
                            },
                            rhs: {
                                type: 'evaluatedVariable',
                                name: 'B',
                                scope: 'current',
                                range: createRange(0, 13, 0, 15),
                            }
                        }
                    ],
                }
            }
        ]);
    });

    it('should work on assigning a struct with multiple evaluated variables', () => {
        const input = `.MyVar = [.A=.B, .C=.D]`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'struct',
                    statements: [
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'A',
                                scope: 'current',
                                range: createRange(0, 10, 0, 12),
                            },
                            rhs: {
                                type: 'evaluatedVariable',
                                name: 'B',
                                scope: 'current',
                                range: createRange(0, 13, 0, 15),
                            }
                        },
                        {
                            type: 'variableDefinition',
                            lhs: {
                                name: 'C',
                                scope: 'current',
                                range: createRange(0, 17, 0, 19),
                            },
                            rhs: {
                                type: 'evaluatedVariable',
                                name: 'D',
                                scope: 'current',
                                range: createRange(0, 20, 0, 22),
                            }
                        }
                    ],
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: {
                    type: 'evaluatedVariable',
                    name: 'OtherVar',
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: {
                    type: 'evaluatedVariable',
                    name: 'OtherVar',
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
                    name: 'MyVar',
                    scope: 'parent',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 123
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: 123
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(2, 12, 2, 18),
                },
                rhs: 123
            }
        ]);
    });

    it('should work on statements with comments on the same line', () => {
        const input = `.MyVar = 123  // Comment`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 123
            }
        ]);
    });

    it('should work on statements with comments on the same with no spaces between', () => {
        const input = `.MyVar = 123// Comment`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 123
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
                    name: 'MyVar1',
                    scope: 'current',
                    range: createRange(1, 12, 1, 19),
                },
                rhs: 1
            },
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar2',
                    scope: 'current',
                    range: createRange(5, 12, 5, 19),
                },
                rhs: 2
            }
        ]);
    });
    
    it('should work on an empty scope', () => {
        const input = `
            {
            }
        `;
        assertParseResultsEqual(input, [
            {
                type: 'scopeStart'
            },
            {
                type: 'scopeEnd'
            }
        ]);
    });

    it('should work on a scope with a statement', () => {
        const input = `
            {
                .MyVar = 123;
            }
        `;
        assertParseResultsEqual(input, [
            {
                type: 'scopeStart'
            },
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(2, 16, 2, 22),
                },
                rhs: 123
            },
            {
                type: 'scopeEnd'
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
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: 'hello'
            },
            {
                type: 'variableAddition',
                lhs: {
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(2, 12, 2, 22),
                },
                rhs: ' world'
            }
        ]);
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
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: 'hello'
            },
            {
                type: 'scopeStart'
            },
            {
                type: 'variableAddition',
                lhs: {
                    name: 'MyMessage',
                    scope: 'parent',
                    range: createRange(3, 16, 3, 26),
                },
                rhs: ' world'
            },
            {
                type: 'scopeEnd'
            }
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
                    name: 'MyName',
                    scope: 'current',
                    range: createRange(1, 12, 1, 19),
                },
                rhs: 'Bobo'
            },
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(2, 12, 2, 22),
                },
                rhs: 'hello'
            },
            {
                type: 'variableAddition',
                lhs: {
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(3, 12, 3, 22),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        ' ',
                        {
                            type: 'evaluatedVariable',
                            name: 'MyName',
                            scope: 'current',
                            range: createRange(3, 27, 3, 35),
                        }
                    ]
                }
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
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: 'hello world'
            }
        ]);
    });

    it('adding a string literal on the same line should use the last referenced variable', () => {
        const input = `.MyMessage = 'hello' + ' world'`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(0, 0, 0, 10),
                },
                rhs: 'hello world'
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
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(1, 12, 1, 22),
                },
                rhs: 'hello world!'
            }
        ]);
    });

    it('adding mulitple string literals on the same line should use the last referenced variable', () => {
        const input = `.MyVar = 'hello' + ' world'+'!'
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: 'hello world!'
            }
        ]);
    });

    it('adding an evaluated variable should use the last referenced variable if none is specified', () => {
        const input = `.MyMessage = 'hello ' + .MyVar`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(0, 0, 0, 10),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        'hello ',
                        {
                            type: 'evaluatedVariable',
                            name: 'MyVar',
                            scope: 'current',
                            range: createRange(0, 24, 0, 30),
                        }
                    ]
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
                    name: 'MyMessage',
                    scope: 'current',
                    range: createRange(0, 0, 0, 10),
                },
                rhs: {
                    type: 'stringExpression',
                    parts: [
                        'hello ',
                        {
                            type: 'evaluatedVariable',
                            name: 'MyVar1',
                            scope: 'current',
                            range: createRange(0, 24, 0, 31),
                        },
                        {
                            type: 'evaluatedVariable',
                            name: 'MyVar2',
                            scope: 'current',
                            range: createRange(0, 34, 0, 41),
                        }
                    ]
                }
            }
        ]);
    });

    it('should work on assigning an empty array', () => {
        const input = `.MyVar = {}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: []
            }
        ]);
    });

    it('should work on assigning an empty array with whitespace', () => {
        const input = `.MyVar = { }`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: []
            }
        ]);
    });

    it('should work on assigning an array of 1 integer', () => {
        const input = `.MyVar = {1}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: [1]
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: [1]
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: [1, 100]
            }
        ]);
    });

    it('should work on assigning an array of integers on the same line with commas', () => {
        const input = `.MyVar = {1,2,3}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: [1, 2, 3]
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
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: [1, 2, 3]
            }
        ]);
    });

    it('should work on assigning an array of strings', () => {
        const input = `.MyVar = {'str1', 'str2'}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: ['str1', 'str2']
            }
        ]);
    });

    it('should work on assigning an array of booleans', () => {
        const input = `.MyVar = {true, false}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: [true, false]
            }
        ]);
    });

    it('should work on assigning an array of evaluated variables', () => {
        const input = `.MyVar = {.A, .B}`;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(0, 0, 0, 6),
                },
                rhs: [
                    {
                        type: 'evaluatedVariable',
                        name: 'A',
                        scope: 'current',
                        range: createRange(0, 10, 0, 12),
                    },
                    {
                        type: 'evaluatedVariable',
                        name: 'B',
                        scope: 'current',
                        range: createRange(0, 14, 0, 16),
                    }
                ]
            }
        ]);
    });

    it('should work on adding an item to an array', () => {
        const input = `
            .MyVar = {}
            .MyVar + 'cow'
        `;
        assertParseResultsEqual(input, [
            {
                type: 'variableDefinition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(1, 12, 1, 18),
                },
                rhs: []
            },
            {
                type: 'variableAddition',
                lhs: {
                    name: 'MyVar',
                    scope: 'current',
                    range: createRange(2, 12, 2, 18),
                },
                rhs: 'cow'
            }
        ]);
    });

    describe('functions', () => {
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
                        name: 'MyVar',
                        scope: 'current',
                        range: createRange(1, 16, 1, 22),
                    },
                    rhs: {
                        type: 'struct',
                        statements: [
                            {
                                type: 'variableDefinition',
                                lhs: {
                                    name: 'MyBool',
                                    scope: 'current',
                                    range: createRange(2, 20, 2, 27),
                                },
                                rhs: true
                            }
                        ],
                    }
                },
                {
                    type: 'using',
                    struct: {
                        type: 'evaluatedVariable',
                        name: 'MyVar',
                        scope: 'current',
                        range: createRange(4, 22, 4, 28),
                    },
                    range: {
                        start: {
                            line: 4,
                            character: 16
                        },
                        end: {
                            line: 4,
                            character: 29
                        }
                    },
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
                        name: 'MyVar',
                        scope: 'current',
                        range: createRange(1, 16, 1, 22),
                    },
                    rhs: {
                        type: 'struct',
                        statements: [
                            {
                                type: 'variableDefinition',
                                lhs: {
                                    name: 'MyBool',
                                    scope: 'current',
                                    range: createRange(2, 20, 2, 27),
                                },
                                rhs: true
                            }
                        ],
                    }
                },
                {
                    type: 'using',
                    struct: {
                        type: 'evaluatedVariable',
                        name: 'MyVar',
                        scope: 'current',
                        range: createRange(4, 26, 4, 32),
                    },
                    range: {
                        start: {
                            line: 4,
                            character: 16
                        },
                        end: {
                            line: 4,
                            character: 35
                        }
                    },
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
                        name: 'MyVar',
                        scope: 'current',
                        range: createRange(1, 16, 1, 22),
                    },
                    rhs: {
                        type: 'struct',
                        statements: [
                            {
                                type: 'variableDefinition',
                                lhs: {
                                    name: 'MyBool',
                                    scope: 'current',
                                    range: createRange(2, 20, 2, 27),
                                },
                                rhs: true
                            }
                        ],
                    }
                },
                {
                    type: 'variableDefinition',
                    lhs: {
                        name: 'Other',
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
                                    name: 'MyVar',
                                    scope: 'current',
                                    range: createRange(5, 26, 5, 32),
                                },
                                range: {
                                    start: {
                                        line: 5,
                                        character: 20
                                    },
                                    end: {
                                        line: 5,
                                        character: 33
                                    }
                                },
                            }
                        ],
                    }
                }
            ]);
        });
    });
});