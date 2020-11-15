import { assert } from 'console';
import * as nearley from 'nearley'
import fbuildGrammar from './fbuild-grammar'

export interface ParsedRange
{
	line: number,
	characterStart: number,
	characterEnd: number
}

export interface ParsedString
{
	range: ParsedRange

	// The value of the string after evaluating variables.
	evaluated: string
}

export interface ParsedData {
	stringTemplates: ParsedString[]
}

export type QuoteChar = '\'' | '"'

export function parse(text: string): ParsedData {
	const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
	parser.feed(text);

	const numResults = parser.results.length;
	assert(numResults == 1, `Should parse to exactly 1 result, but parsed to ${numResults}`);
	const statements = parser.results[0];

	let stringTemplates: ParsedString[] = [];

	for (const statement of statements) {
		switch (statement.type) {
			case 'variableDefinition':
				const rhs = statement.rhs;
				if (rhs.type && rhs.type == 'stringTemplate') {
					let evaluated = '';
					for (const part of rhs.parts) {
						if (part.type && part.type == 'evaluatedVariable') {
							evaluated += `TodoEvaluate[${part.name}]`
						} else {
							// Literal
							evaluated += part;
						}
					}

					stringTemplates.push({
						evaluated: evaluated,
						range: {
							line: 0,
							characterStart: 0,
							characterEnd: 0
						}
					})
				}
				break;
		}
	}
	
	return {
		stringTemplates: stringTemplates
	};
}