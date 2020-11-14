import * as assert from 'assert';
import * as parser from '../parser'

describe('parse', () => {
	it('should work on empty input', () => {
		const input = '';
		const result: parser.ParsedData = parser.parse(input);
		assert.deepStrictEqual(result.strings, []);
	});

	it('should work on strings with single quotes', () => {
		const input = `.MyVar = 'MyString'`;
		const result: parser.ParsedData = parser.parse(input);
		const expectedStrings: parser.ParsedString[] = [
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
		const result: parser.ParsedData = parser.parse(input);
		const expectedStrings: parser.ParsedString[] = [
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
		const result: parser.ParsedData = parser.parse(input);
		const expectedStrings: parser.ParsedString[] = [
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
		const result: parser.ParsedData = parser.parse(input);
		const expectedStrings: parser.ParsedString[] = [
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

	/*
	.MyVar = "MyValue"
	.Evaluated = 'pre-$MyVar$-post'
	.MultipleEvaluated = 'pre-$MyVar$-$MyVar$-post'
	.Copy = .MyVar
	*/
});