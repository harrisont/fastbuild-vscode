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
			assert.strictEqual(parser.results.length, 1);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on space', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = ` `;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on empty lines', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `
			

			`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1);
			const result = parser.results[0];
			assert.deepStrictEqual(result, []);
		});

		it('should work on assignment to current scope', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `.MyVar = 123`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: "variableDefinition",
					lhs: {
						name: "MyVar",
						scope: "current"
					},
					rhs: 123
				}
			]);
		});

		it('should work on assignment to parent scope', () => {
			const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
			const input = `^MyVar = 123`;
			parser.feed(input);
			assert.strictEqual(parser.results.length, 1);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: "variableDefinition",
					lhs: {
						name: "MyVar",
						scope: "parent"
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
			assert.strictEqual(parser.results.length, 1);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: "variableDefinition",
					lhs: {
						name: "MyVar",
						scope: "current"
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
			assert.strictEqual(parser.results.length, 1);
			const result = parser.results[0];
			assert.deepStrictEqual(result, [
				{
					type: "variableDefinition",
					lhs: {
						name: "MyVar1",
						scope: "current"
					},
					rhs: 1
				},
				{
					type: "variableDefinition",
					lhs: {
						name: "MyVar2",
						scope: "current"
					},
					rhs: 2
				}
			]);
		});
	}),
	describe('strings', () => {
		it('should work on empty input', () => {
			const input = '';
			const result: ParsedData = parse(input);
			assert.deepStrictEqual(result.strings, []);
		});
	
		/*
		it('should work on strings with single quotes', () => {
			const input = `.MyVar = 'MyString'`;
			const result: ParsedData = parse(input);
			const expectedStrings: ParsedString[] = [
				{
					raw: "MyString",
					evaluated: "TODO:MyString",
					range: {
						line: 0,
						characterStart: 10,
						characterEnd: 18
					}
				}
			];
			assert.deepStrictEqual(result.strings, expectedStrings);
		});
	
		it('should work on strings with double quotes', () => {
			const input = `.MyVar = "MyString"`;
			const result: ParsedData = parse(input);
			const expectedStrings: ParsedString[] = [
				{
					raw: "MyString",
					evaluated: "TODO:MyString",
					range: {
						line: 0,
						characterStart: 10,
						characterEnd: 18
					}
				}
			];
			assert.deepStrictEqual(result.strings, expectedStrings);
		});
	
		it('should work on strings with single quotes with a double quote inside', () => {
			const input = `.MyVar = 'My"String'`;
			const result: ParsedData = parse(input);
			const expectedStrings: ParsedString[] = [
				{
					raw: "My\"String",
					evaluated: "TODO:My\"String",
					range: {
						line: 0,
						characterStart: 10,
						characterEnd: 19
					}
				}
			];
			assert.deepStrictEqual(result.strings, expectedStrings);
		});
	
		it('should work on strings with double quotes with a single quote inside', () => {
			const input = `.MyVar = "My'String"`;
			const result: ParsedData = parse(input);
			const expectedStrings: ParsedString[] = [
				{
					raw: "My'String",
					evaluated: "TODO:My'String",
					range: {
						line: 0,
						characterStart: 10,
						characterEnd: 19
					}
				}
			];
			assert.deepStrictEqual(result.strings, expectedStrings);
		});
	
		it('should work on strings with a variable', () => {
			const input = `
				.MyVar = "MyValue"
				.Evaluated = 'pre-$MyVar$-post'
			`;
			const result: ParsedData = parse(input);
			const expectedStrings: ParsedString[] = [
				{
					raw: "MyValue",
					evaluated: "TODO:MyValue",
					range: {
						line: 1,
						characterStart: 13,
						characterEnd: 20
					}
				},
				{
					raw: "pre-$MyVar$-post",
					evaluated: "pre-MyValue-post",
					range: {
						line: 2,
						characterStart: 17,
						characterEnd: 33
					}
				}
			];
			assert.deepStrictEqual(result.strings, expectedStrings);
		});
	
		it('should work on strings with multiple variables', () => {
			const input = `
				.MyVar1 = "MyValue1"
				.MyVar2 = "MyValue2"
				.Evaluated = 'pre-$MyVar1$-$MyVar2$-post'
			`;
			const result: ParsedData = parse(input);
			const expectedStrings: ParsedString[] = [
				{
					raw: "MyValue1",
					evaluated: "TODO:MyValue1",
					range: {
						line: 1,
						characterStart: 14,
						characterEnd: 22
					}
				},
				{
					raw: "MyValue2",
					evaluated: "TODO:MyValue2",
					range: {
						line: 2,
						characterStart: 14,
						characterEnd: 22
					}
				},
				{
					raw: "pre-$MyVar1$-$MyVar2$-post",
					evaluated: "pre-MyValue1-MyValue2-post",
					range: {
						line: 3,
						characterStart: 17,
						characterEnd: 43
					}
				}
			];
			assert.deepStrictEqual(result.strings, expectedStrings);
		});
		*/
	
		/*
		.MyVar = "MyValue"
		.Evaluated = 'pre-$MyVar$-post'
		.MultipleEvaluated = 'pre-$MyVar$-$MyVar$-post'
		.Copy = .MyVar
		*/
	});
});