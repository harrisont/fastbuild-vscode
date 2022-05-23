//
// Integration test
//

import * as assert from 'assert';
import {
    IConnection,
    IEvent,
    ITextDocument,
    ITextDocuments,
    ITextDocumentChangeEvent
} from '../fileSystem';

import {
    Server
} from '../server';

// TODO: replace this with a mock implementation of IConnection.
import {
    createConnection,
    ProposedFeatures
} from 'vscode-languageserver';

class MockPosition {
    constructor(readonly line: number, readonly character: number) {
    }
}

class MockRange {
    constructor(readonly start: MockPosition, readonly end: MockPosition) {
    }
}

class MockTextDocument implements ITextDocument {
    /**
     * The associated URI for this document. Most documents have the __file__-scheme, indicating that they
     * represent files on disk. However, some documents may have other schemes indicating that they are not
     * available on disk.
     *
     * @readonly
     */
    readonly uri: string = "";

    /**
     * The identifier of the language associated with this document.
     *
     * @readonly
     */
    readonly languageId: string = "";

    /**
     * The version number of this document (it will increase after each
     * change, including undo/redo).
     *
     * @readonly
     */
    readonly version: number = 0;

    /**
     * The number of lines in this document.
     *
     * @readonly
     */
    readonly lineCount = 0;

    /**
     * Get the text of this document. A substring can be retrieved by
     * providing a range.
     *
     * @param range (optional) An range within the document to return.
     * If no range is passed, the full content is returned.
     * Invalid range positions are adjusted as described in [Position.line](#Position.line)
     * and [Position.character](#Position.character).
     * If the start range position is greater than the end range position,
     * then the effect of getText is as if the two positions were swapped.
     *
     * @return The text of this document or a substring of the text if a
     *         range is provided.
     */
    getText(range?: MockRange): string {
        return "";
    }

    /**
     * Converts a zero-based offset to a position.
     *
     * @param offset A zero-based offset.
     * @return A valid [position](#Position).
     */
    positionAt(offset: number): MockPosition {
        return new MockPosition(0, 0);
    }

    /**
     * Converts the position to a zero-based offset.
     * Invalid positions are adjusted as described in [Position.line](#Position.line)
     * and [Position.character](#Position.character).
     *
     * @param position A position.
     * @return A valid zero-based offset.
     */
    offsetAt(position: MockPosition): number {
        return 0;
    }
}

class MockTextDocuments implements ITextDocuments {
    /**
     * An event that fires when a text document managed by this manager
     * has been opened or the content changes.
     */
    onDidChangeContent: IEvent<ITextDocumentChangeEvent<ITextDocument>>;

    /**
     * An event that fires when a text document managed by this manager
     * has been opened.
     */
    onDidOpen: IEvent<ITextDocumentChangeEvent<ITextDocument>>;
    
    /**
     * An event that fires when a text document managed by this manager
     * has been closed.
     */
    onDidClose: IEvent<ITextDocumentChangeEvent<ITextDocument>>;
    
    /**
     * Returns the document for the given URI.
     * Returns undefined if the document is not mananged by this instance.
     *
     * @param uri The text document's URI to retrieve.
     * @return the text document or `undefined`.
     */
    get(uri: string): ITextDocument | undefined {
        return undefined;
    }
    
    /**
     * Listens for `low level` notification on the given connection to
     * update the text documents managed by this instance.
     *
     * @param connection The connection to listen on.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    listen(connection: IConnection): void
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    {
    }
}

describe('server', () => {
    describe('TODO-category-name', () => {
        it('TODO-test-name', () => {
            const connection = createConnection(ProposedFeatures.all);
            const documents = new MockTextDocuments();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const server = new Server(connection, documents);
            // TODO: add test content
            assert.strictEqual(1, 1);
        });
    });
});