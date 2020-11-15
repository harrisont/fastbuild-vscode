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

interface VariableDefinitionLhs {
	name: string,
	scope: 'current' | 'parent'
}

export function parse(text: string): ParsedData {
	const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
	parser.feed(text);

	const numResults = parser.results.length;
	assert(numResults == 1, `Should parse to exactly 1 result, but parsed to ${numResults}`);
	const statements = parser.results[0];

	let stringTemplates: ParsedString[] = [];

	let variables = new Map<string, boolean | number | string>();

	for (const statement of statements) {
		switch (statement.type) {
			case 'variableDefinition':
				const rhs = statement.rhs;

				let evaluatedRhs: number | boolean | string = 0;
				if (rhs.type && rhs.type == 'stringTemplate') {
					evaluatedRhs = ""
					for (const part of rhs.parts) {
						if (part.type && part.type == 'evaluatedVariable') {
							const variableName: string = part.name;
							const variableValue = variables.get(variableName);
							assert(variableValue !== undefined, `Referencing undefined variable "${variableName}"`)
							evaluatedRhs += `${variableValue}`;
						} else {
							// Literal
							evaluatedRhs += part;
						}
					}

					stringTemplates.push({
						evaluated: evaluatedRhs,
						range: {
							line: 0,
							characterStart: 0,
							characterEnd: 0
						}
					})
				} else {
					evaluatedRhs = rhs;
				}

				const lhs: VariableDefinitionLhs = statement.lhs;
				// TODO: handle lhs.scope (current or parent)
				variables.set(lhs.name, evaluatedRhs);
				break;
		}
	}
	
	return {
		stringTemplates: stringTemplates
	};
}