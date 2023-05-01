// Either a T value or an Error, but not both.
export class Maybe<T> {
    private constructor(readonly hasError: boolean, private readonly _value: T | null, private readonly _error: Error | null) {
    }

    static ok<U>(value: U): Maybe<U> {
        return new Maybe<U>(false /*hasError*/, value, null /*_error*/);
    }

    static error<U>(error: Error): Maybe<U> {
        return new Maybe<U>(true /*hasError*/, null /*_value*/, error);
    }

    // Throws an Error if |hasError| is |true|.
    getValue(): T {
        if (this.hasError === true) {
            throw new Error(`'Maybe' has an error, not a value. Check 'hasError' before calling 'getValue'. Error: ${this._error}`);
        }
        return <T>this._value;
    }

    // Throws an Error if |hasError| is |false|.
    getError(): Error {
        if (this._error === null) {
            throw new Error("'Maybe' has a value, not an error. Check 'hasError' before calling 'getValue'.");
        }
        return this._error;
    }
}
