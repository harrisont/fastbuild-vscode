import * as assert from 'assert';

import * as nearley from 'nearley'
import fbuildGrammar from '../fbuild-grammar'

import {
	parse,
	ParsedData,
	EvaluatedVariable,
	Value,
} from '../parser'

// Compares the parsed evaluatedVariables, but only the value, not the range.
function assertEvaluatedVariablesValueEqual(input: string, expectedValues: Value[]): void {
	const result: ParsedData = parse(input);
	const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
	assert.deepStrictEqual(actualValues, expectedValues);
}

describe('parser', () => {
	describe('parse', () => {
		it('should work on empty input', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = ``;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on space', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = ` `;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on empty lines', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `
			

			`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on "//" comment', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `// My comment`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on ";" comment', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `; My comment`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on empty comment', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `//`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on assigning an integer', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = 123`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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

		it('should work on assigning true', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = true`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = false`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = 'hi'`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = "hi"`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = 'h"i'`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = "h'i"`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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

		it('should work on assigning a single quoted string with a variable', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = 'pre-$OtherVar$-post'`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [
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
			]);
		});

		it('should work on assigning a double quoted string with a variable', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = 'pre-$OtherVar$-post'`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [
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
			]);
		});

		it('should work on assigning a string with multiple variables', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = 'pre-$OtherVar1$-$OtherVar2$-post'`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [
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
			]);
		});

		it('should work on assigning the value of another variable', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = .OtherVar`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: 'variableDefinition',
					lhs: {
						name: 'MyVar',
						scope: 'current'
					},
					rhs: [
						{
							type: 'evaluatedVariable',
							name: 'OtherVar',
							line: 0,
							characterStart: 9,
							characterEnd: 10000,  // TODO: see known issue in README.md
						},
					]
				}
			]);
		});

		it('should work on assignment to parent scope', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `^MyVar = 123`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `
				.MyVar = 123
				`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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

		it('should work on multiple statements with whitespace', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `
				.MyVar1 = 1



				.MyVar2 = 2
				`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `
				{
				}
				`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: 'scopeStart'
				},
				{
					type: 'scopeEnd'
				}
			]);
		});

		it('should work on a scope with a statement', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `
				{
					.MyVar = 123;
				}
				`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1, `Should parse to exactly 1 result, but parsed to ${parser.results.length} results.`);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
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
				.MyVar = 1
				.Copy = .MyVar
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
			// TODO: detect assert
			assertEvaluatedVariablesValueEqual(input, []);
		});

		it('should be able to write a variable in a direct parent scope', () => {
			const input = `
				.Var1 = 1
				{
					^Var1 = 2
				}
				.Var2 = .Var1
			`;
			assertEvaluatedVariablesValueEqual(input, [2]);
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
			// TODO: detect assert
			assertEvaluatedVariablesValueEqual(input, []);
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