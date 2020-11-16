import * as assert from 'assert';

import * as nearley from 'nearley'
import fbuildGrammar from '../fbuild-grammar'

import {
	parse,
	ParsedData,
	ParsedString,
} from '../parser'

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
					rhs: {
						type: 'stringTemplate',
						parts: [
							'pre-',
							{
								type: 'evaluatedVariable',
								name: 'OtherVar'
							},
							'-post'
						]
					}
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
					rhs: {
						type: 'stringTemplate',
						parts: [
							'pre-',
							{
								type: 'evaluatedVariable',
								name: 'OtherVar'
							},
							'-post'
						]
					}
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
					rhs: {
						type: 'stringTemplate',
						parts: [
							'pre-',
							{
								type: 'evaluatedVariable',
								name: 'OtherVar1'
							},
							'-',
							{
								type: 'evaluatedVariable',
								name: 'OtherVar2'
							},
							'-post'
						]
					}
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
					rhs: {
						name: 'OtherVar',
					}
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
	}),
	describe('stringTemplates', () => {	
		it('should work on string with a variable', () => {
			const input = `
				.MyVar = "MyValue"
				.Evaluated = 'pre-$MyVar$-post'
			`;
			const result: ParsedData = parse(input);
			const expectedStrings: ParsedString[] = [
				{
					evaluated: 'pre-MyValue-post',
					range: {
						line: 0,
						characterStart: 0,
						characterEnd: 0
					}
				}
			];
			assert.deepStrictEqual(result.stringTemplates, expectedStrings);
		});
		it('should work on string with multiple variables', () => {
			const input = `
				.MyVar1 = "MyValue1"
				.MyVar2 = "MyValue2"
				.Evaluated = 'pre-$MyVar1$-$MyVar2$-post'
			`;
			const result: ParsedData = parse(input);
			const expectedStrings: ParsedString[] = [
				{
					evaluated: 'pre-MyValue1-MyValue2-post',
					range: {
						line: 0,
						characterStart: 0,
						characterEnd: 0
					}
				}
			];
			assert.deepStrictEqual(result.stringTemplates, expectedStrings);
		});
	});
});