import {
	Hover,
	HoverParams,
	MarkupKind,
} from 'vscode-languageserver';

import * as evaluator from './evaluator'

export class HoverProvider {
	private parsedData: evaluator.ParsedData | null = null;

	onParsedDataChanged(newParsedData: evaluator.ParsedData): void {
		this.parsedData = newParsedData;
	}
	
	onHover(params: HoverParams): Hover | null {
		const position = params.position;
		const evaluatedVariables = this.parsedData?.evaluatedVariables ?? [];
	
		for (let i = 0; i < evaluatedVariables.length; i++)
		{
			const range = evaluatedVariables[i].range;
			if (range.line == position.line
			   && (range.characterStart <= position.character && range.characterEnd >= position.character))
			{
				const value = evaluatedVariables[i].value;
				
				const hoverText = JSON.stringify(value);
	
				const hover: Hover = {
					contents: {
						kind: MarkupKind.PlainText,
						value: hoverText
					},
					range: {
						start: {
							line: range.line,
							character: range.characterStart,
						},
						end: {
							line: range.line,
							character: range.characterEnd
						}
					}
				}
				return hover;
			}
		}

		return null;
	}
}