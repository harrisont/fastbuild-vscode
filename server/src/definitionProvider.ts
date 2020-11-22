import { SourceMap } from 'module';
import {
	DefinitionLink,
	DefinitionParams,
} from 'vscode-languageserver-protocol';

import {
	DocumentUri,
} from 'vscode-languageserver-types';

import {
	ParsedData,
	SourceRange,
} from './evaluator'

export class DefinitionProvider {
	private parsedData: ParsedData | null = null;
	private uri: DocumentUri | null = null;

	onParsedDataChanged(uri: DocumentUri, newParsedData: ParsedData): void {
		this.parsedData = newParsedData;
		this.uri = uri;
	}

	onDefinition(params: DefinitionParams): DefinitionLink[] | null {
		if (!this.uri) {
			return null;
		}

		const position = params.position;
		const variableReferences = this.parsedData?.variableReferences ?? [];
	
		for (let i = 0; i < variableReferences.length; i++)
		{
			const variableReference = variableReferences[i];
			const variableReferenceRange = variableReference.range;
			// TODO: also match params.textDocument.uri
			if (SourceRange.isPositionInRange(position, variableReference.range))
			{
				const definition = variableReference.definition;

				const definitionLink: DefinitionLink = {
					originSelectionRange: variableReference.range,
					targetUri: this.uri,
					targetRange: definition.range,
					targetSelectionRange: definition.range,
				}
				return [definitionLink];
			}
		}
	
		return null;
	}
}