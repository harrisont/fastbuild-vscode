import * as assert from 'assert';

import fbuildGrammar from '../fbuild-grammar'

import {
	parse,
	nearleyParse,
	ParsedData,
	EvaluatedVariable,
	Value,
} from '../parser'

function assertParseResultsEqual(input: string, expectedResult: any[]): void {
	const result = nearleyParse(input);
	assert.deepStrictEqual(result, expectedResult);
}

// Compares the parsed evaluatedVariables, but only the value, not the range.
function assertEvaluatedVariablesValueEqual(input: string, expectedValues: Value[]): void {
	const result: ParsedData = parse(input);
	const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
	assert.deepStrictEqual(actualValues, expectedValues);
}

describe('parser', () => {
	describe('parse', () => {
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
			const input = `.My_Var = 123`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'My_Var',
						scope: 'current'
					},
					rhs: 123
				}
			]);
		});

		it('should work on assigning an integer across multiple lines', () => {
			const input = `
				.My_Var

					=
					
					123
			`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'My_Var',
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
					},
					rhs: false
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
					},
					rhs: {
						type: 'stringExpression',
						parts: [
							'pre-',
							{
								type: 'evaluatedVariable',
								name: 'OtherVar',
								line: 0,
								characterStart: 14,
								characterEnd: 24,
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
						scope: 'current'
					},
					rhs: {
						type: 'stringExpression',
						parts: [
							'pre-',
							{
								type: 'evaluatedVariable',
								name: 'OtherVar',
								line: 0,
								characterStart: 14,
								characterEnd: 24,
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
						scope: 'current'
					},
					rhs: {
						type: 'stringExpression',
						parts: [
							'pre-',
							{
								type: 'evaluatedVariable',
								name: 'OtherVar1',
								line: 0,
								characterStart: 14,
								characterEnd: 25,
							},
							'-',
							{
								type: 'evaluatedVariable',
								name: 'OtherVar2',
								line: 0,
								characterStart: 26,
								characterEnd: 37,
							},
							'-post'
						]
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
						scope: 'current'
					},
					rhs: {
						type: 'stringExpression',
						parts: [
							{
								type: 'evaluatedVariable',
								name: 'OtherVar',
								line: 0,
								characterStart: 9,
								characterEnd: 10000,  // TODO: see known issue in README.md
							},
						]
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
						scope: 'current'
					},
					rhs: {
						type: 'stringExpression',
						parts: [
							{
								type: 'evaluatedVariable',
								name: 'OtherVar',
								line: 5,
								characterStart: 5,
								characterEnd: 10000,  // TODO: see known issue in README.md
							},
						]
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
						scope: 'parent'
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
						scope: 'current'
					},
					rhs: 123
				}
			]);
		});

		it('should work on statements with comments on different lines', () => {
			const input = `
					// Comment 1
					.My_Var = 123
					// Comment 2
			`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'My_Var',
						scope: 'current'
					},
					rhs: 123
				}
			]);
		});

		it('should work on statements with comments on the same line', () => {
			const input = `.My_Var = 123  // Comment`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'My_Var',
						scope: 'current'
					},
					rhs: 123
				}
			]);
		});

		it('should work on statements with comments on the same with no spaces between', () => {
			const input = `.My_Var = 123// Comment`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'My_Var',
						scope: 'current'
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
						scope: 'current'
					},
					rhs: 1
				},
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar2',
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
					},
					rhs: 'hello'
				},
				{
					type: 'variableAddition',
					lhs: {
						name: 'MyMessage',
						scope: 'current'
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
						scope: 'current'
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
						scope: 'parent'
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
						scope: 'current'
					},
					rhs: 'Bobo'
				},
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyMessage',
						scope: 'current'
					},
					rhs: 'hello'
				},
				{
					type: 'variableAddition',
					lhs: {
						name: 'MyMessage',
						scope: 'current'
					},
					rhs: {
						type: 'stringExpression',
						parts: [
							' ',
							{
								type: 'evaluatedVariable',
								name: 'MyName',
								line: 3,
								characterStart: 19,
								characterEnd: 27,
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
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
						scope: 'current'
					},
					rhs: {
						type: 'stringExpression',
							parts: [
							'hello ',
							{
								type: 'evaluatedVariable',
								name: 'MyVar',
								line: 0,
								characterStart: 24,
								characterEnd: 10000,  // TODO: see known issue in README.md
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
						scope: 'current'
					},
					rhs: {
						type: 'stringExpression',
						parts: [
							'hello ',
							{
								type: 'evaluatedVariable',
								name: 'MyVar1',
								line: 0,
								characterStart: 24,
								characterEnd: 10000,  // TODO: see known issue in README.md
							},
							{
								type: 'evaluatedVariable',
								name: 'MyVar2',
								line: 0,
								characterStart: 34,
								characterEnd: 10000,  // TODO: see known issue in README.md
							}
						]
					}
				}
			]);
		});

		it('should work on assigning an empty array', () => {
			const input = `.MyVar = []`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: []
				}
			]);
		});

		it('should work on assigning an empty array with whitespace', () => {
			const input = `.MyVar = [ ]`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: []
				}
			]);
		});

		it('should work on assigning an array of 1 integer', () => {
			const input = `.MyVar = [1]`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [1]
				}
			]);
		});

		it('should work on assigning an array of 1 integer with whitespace', () => {
			const input = `
				.MyVar = [
						   1 ]
			`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [1]
				}
			]);
		});

		it('should work on assigning an array of integers', () => {
			const input = `.MyVar = [1,100]`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [1, 100]
				}
			]);
		});

		it('should work on assigning an array of integers with whitespace', () => {
			const input = `
				.MyVar = [1 , 2,
						  3]
			`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [1, 2, 3]
				}
			]);
		});

		it('should work on assigning an array of strings', () => {
			const input = `.MyVar = ['str1', 'str2']`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: ['str1', 'str2']
				}
			]);
		});

		it('should work on assigning an array of booleans', () => {
			const input = `.MyVar = [true, false]`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [true, false]
				}
			]);
		});

		it('should work on adding an item to an array', () => {
			const input = `
				.MyVar = []
				.MyVar + 'cow'
			`;
			assertParseResultsEqual(input, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: []
				},
				{
					type: 'variableAddition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: 'cow'
				}
			]);
		});
	}),

	describe('evaluatedVariables value', () => {
		it('should be detected in a string with a variable', () => {
			const input = `
				.MyVar = 'MyValue'
				.Evaluated = 'pre-$MyVar$-post'
			`;
			assertEvaluatedVariablesValueEqual(input, ['MyValue']);
		});

		it('should be detected in a string with multiple variables', () => {
			const input = `
				.MyVar1 = 'MyValue1'
				.MyVar2 = 'MyValue2'
				.Evaluated = 'pre-$MyVar1$-$MyVar2$-post'
			`;
			assertEvaluatedVariablesValueEqual(input, ['MyValue1', 'MyValue2']);
		});

		it('should be detected in the RHS when assigning the value of another variable', () => {
			const input = `
				.My_Var = 1
				.Copy = .My_Var
			`;
			assertEvaluatedVariablesValueEqual(input, [1]);
		});

		it('should be able to read a variable in a direct parent scope', () => {
			const input = `
				.Var1 = 1
				{
					.Var2 = .Var1
				}
			`;
			assertEvaluatedVariablesValueEqual(input, [1]);
		});
		
		it('should be able to read a variable in a grandparent scope', () => {
			const input = `
				.Var1 = 1
				{
					{
						.Var2 = .Var1
					}
				}
			`;
			assertEvaluatedVariablesValueEqual(input, [1]);
		});

		it('should allow variables with the same name in different scopes', () => {
			const input = `
				{
					.Var1 = 1
					.Var2 = .Var1
				}
				{
					.Var1 = 2
					.Var2 = .Var1
				}
			`;
			assertEvaluatedVariablesValueEqual(input, [1, 2]);
		});

		it('should allow a variable to shadow a variable with the same name in a parent scope', () => {
			const input = `
				.Var = 1
				{
					.Var = 2
					.Inner = .Var
				}
				.Outer = .Var
			`;
			assertEvaluatedVariablesValueEqual(input, [2, 1]);
		});

		it('should not be able to read a variable in a child scope', () => {
			const input = `
				{
					.Var1 = 1
				}
				.Var2 = .Var1
			`;
			assert.throws(
				() => parse(input),
				{
					name: 'ParseError',
					message: 'Referencing variable "Var1" that is undefined in the current scope or any of the parent scopes.'
				}
			);
		});

		it('should be able to write an existing variable in a direct parent scope', () => {
			const input = `
				.Var1 = 1
				{
					^Var1 = 2
				}
				.Var2 = .Var1
			`;
			assertEvaluatedVariablesValueEqual(input, [2]);
		});

		it('should not be able to write a non-existant variable in a parent scope', () => {
			const input = `
				{
					^Var1 = 1
				}
			`;
			assert.throws(
				() => parse(input),
				{
					name: 'ParseError',
					message: 'Cannot update variable "Var1" in parent scope because the variable does not exist in the parent scope.'
				}
			);
		});

		it('should not be able to write a variable in a grandparent scope', () => {
			const input = `
				.Var1 = 1
				{
					{
						^Var1 = 2
					}
				}
			`;
			assert.throws(
				() => parse(input),
				{
					name: 'ParseError',
					message: 'Cannot update variable "Var1" in parent scope because the variable does not exist in the parent scope.'
				}
			);
		});

		it('should work on adding a string literal', () => {
			const input = `
				.MyMessage = 'hello'
				.MyMessage + ' world'
				.Evaluated = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['hello world']);
		});

		it('should work on adding a string literal to a variable in the parent scope', () => {
			const input = `
				.MyMessage = 'hello'
				{
					^MyMessage + ' world'
				}
				.Evaluated = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['hello world']);
		});

		it('should work on adding a string with a variable', () => {
			const input = `
				.MyName = 'Bobo'
				.MyMessage = 'hello'
				.MyMessage + .MyName
				.Evaluated = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['Bobo', 'helloBobo']);
		});

		it('should work on adding a string with a string template', () => {
			const input = `
				.MyName = 'Bobo'
				.MyMessage = 'hello'
				.MyMessage + ' $MyName$'
				.Evaluated = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['Bobo', 'hello Bobo']);
		});

		it('adding a string literal should use the last referenced variable if none is specified', () => {
			const input = `
				.MyMessage = 'hello'
							+ ' world'
				.Evaluated = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['hello world']);
		});

		it('adding mulitple string literals should use the last referenced variable if none is specified', () => {
			const input = `
				.MyMessage = 'hello'
					       + ' world'
					       + '!'
				.Evaluated = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['hello world!']);
		});

		it('adding an evaluated variable should use the last referenced variable if none is specified', () => {
			const input = `
				.MyVar = 'world'
				.MyMessage = 'hello '
				           + .MyVar
				.Evaluated = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['world', 'hello world']);
		});

		it('adding mulitple evaluated variables should use the last referenced variable if none is specified', () => {
			const input = `
				.MyVar1 = 'world'
				.MyVar2 = '!'
				.MyMessage = 'hello '
					       + .MyVar1
					       + .MyVar2
				.Evaluated = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['world', '!', 'hello world!']);
		});

		it('should work on adding a string literal to a variable in the parent scope', () => {
			const input = `
				.MyMessage = 'hello'
				{
					^MyMessage + ' world'
					.Evaluated1 = .MyMessage
				}
				.Evaluated2 = .MyMessage
			`;
			assertEvaluatedVariablesValueEqual(input, ['hello world', 'hello world']);
		});

		it('should fail when adding a string to a variable not in scope (current scope)', () => {
			const input = `
				.MyMessage = 'hello'
				{
					.MyMessage + ' world'
				}
			`;
			assert.throws(
				() => parse(input),
				{
					name: 'ParseError',
					message: 'Referencing varable "MyMessage" that is undefined in the current scope.'
				}
			);
		});

		it('should fail when adding a string to a variable not in scope (parent scope)', () => {
			const input = `
				{
					^MyMessage + ' world'
				}
			`;
			assert.throws(
				() => parse(input),
				{
					name: 'ParseError',
					message: 'Referencing varable "MyMessage" that is undefined in the parent scope.'
				}
			);
		});

		it('should work on adding an item to an array', () => {
			const input = `
				.MyVar = []
				.MyVar + 'cow'
				.Result = .MyVar
			`;
			assertEvaluatedVariablesValueEqual(input, [['cow']]);
		});
	});

	describe('evaluatedVariables range', () => {
		it('should be detected in a string with multiple variables', () => {
			const input = `
				.MyVar1 = 'MyValue1'
				.MyVar2 = 'MyValue2'
				.Evaluated = 'pre-$MyVar1$-$MyVar2$-post'
			`;
			const result: ParsedData = parse(input);
			const expectedEvaluatedVariables: EvaluatedVariable[] = [
				{
					value: 'MyValue1',
					range: {
						line: 3,
						characterStart: 22,
						characterEnd: 30,
					}
				},
				{
					value: 'MyValue2',
					range: {
						line: 3,
						characterStart: 31,
						characterEnd: 39,
					}
				}
			];
			assert.deepStrictEqual(result.evaluatedVariables, expectedEvaluatedVariables);
		});

		it('should be detected when assigning the value of another variable', () => {
			const input = `
				.MyVar = 'MyValue'
				.Copy = .MyVar
			`;
			const result: ParsedData = parse(input);
			const expectedEvaluatedVariables: EvaluatedVariable[] = [
				{
					value: 'MyValue',
					range: {
						line: 2,
						characterStart: 12,
						characterEnd: 10000,  // TODO: see known issue in README.md
					}
				}
			];
			assert.deepStrictEqual(result.evaluatedVariables, expectedEvaluatedVariables);
		});
	});
});