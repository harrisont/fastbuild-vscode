import {
	Hover,
	HoverParams,
	MarkupKind,
} from 'vscode-languageserver';

import {
	SourceRange,
} from './parser'

import {
	EvaluatedData,
	Struct,
	Value,
} from './evaluator';

const FASTBUILD_LANGUAGE_ID = 'fastbuild';
const INDENTATION = ' '.repeat(4);

export function valueToString(value: Value, indentation: string = ''): string {
	if (value instanceof Struct) {
		const itemIndentation = indentation + INDENTATION;
		const items = Array.from(value.entries()).map(
			([varName, varValue]) => `${itemIndentation}.${varName} = ${valueToString(varValue, itemIndentation)}`
		);
		const lines = [
			'[',
			...items,
			indentation + ']'
		];
		return lines.join('\n');
	} else if (value instanceof Array) {
		const itemIndentation = indentation + INDENTATION;
		const items = value.map(
			(itemValue) => `${itemIndentation}${valueToString(itemValue, itemIndentation)}`
		);
		const lines = [
			'{',
			...items,
			indentation + '}'
		];
		return lines.join('\n');
	} else {
		return JSON.stringify(value);
	}
}

export class HoverProvider {
	private evaluatedData: EvaluatedData | null = null;

	onEvaluatedDataChanged(newEvaluatedData: EvaluatedData): void {
		this.evaluatedData = newEvaluatedData;
	}
	
	onHover(params: HoverParams): Hover | null {
		const position = params.position;
		const evaluatedVariables = this.evaluatedData?.evaluatedVariables ?? [];
	
		for (let i = 0; i < evaluatedVariables.length; i++)
		{
			const evaluatedVariable = evaluatedVariables[i];
			const range = evaluatedVariable.range;
			// TODO: also match params.textDocument.uri
			if (SourceRange.isPositionInRange(position, evaluatedVariable.range))
			{
				const value = evaluatedVariable.value;
				const valueStr = valueToString(value);
				const hoverText = '```' + FASTBUILD_LANGUAGE_ID + '\n' + valueStr + '\n```';
	
				const hover: Hover = {
					contents: {
						kind: MarkupKind.Markdown,
						value: hoverText
					},
					range: evaluatedVariable.range
				}
				return hover;
			}
		}

		return null;
	}
}