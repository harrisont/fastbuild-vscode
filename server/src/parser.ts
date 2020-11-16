import { assert } from 'console';
import * as nearley from 'nearley'
import fbuildGrammar from './fbuild-grammar'

export interface SourceRange
{
	line: number,
	characterStart: number,
	characterEnd: number
}

export type Value = boolean | number | string;

export interface EvaluatedVariable
{
	range: SourceRange
	value: Value
}

export interface ParsedData {
	evaluatedVariables: EvaluatedVariable[]
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

	let evaluatedVariables: EvaluatedVariable[] = [];

	let variables = new Map<string, Value>();

	for (const statement of statements) {
		switch (statement.type) {
			case 'variableDefinition':
				const rhs = statement.rhs;

				let evaluatedRhs: number | boolean | string = 0;
				if (rhs instanceof Array) {
					evaluatedRhs = ""
					for (const part of rhs) {
						if (part.type && part.type == 'evaluatedVariable') {
							const variableName: string = part.name;
							const variableValue = variables.get(variableName);
							if (variableValue === undefined) {
								assert(false, `Referencing undefined variable "${variableName}"`);
							} else {
								const variableValueString = String(variableValue);
								evaluatedRhs += variableValueString;
	
								evaluatedVariables.push({
									value: variableValue,
									range: {
										line: part.line,
										characterStart: part.characterStart,
										characterEnd: part.characterEnd,
									}
								});
							}
						} else {
							// Literal
							evaluatedRhs += part;
						}
					}
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
		evaluatedVariables: evaluatedVariables
	};
}