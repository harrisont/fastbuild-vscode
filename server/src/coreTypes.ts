// Either a T value or an Error, but not both.
export class Maybe<T> {
    static ok<U>(value: U): Maybe<U> {
        return new Maybe<U>(false /*hasError*/, value, null /*_error*/);
    }

    static error<U>(error: Error): Maybe<U> {
        return new Maybe<U>(true /*hasError*/, null /*_value*/, error);
    }

    private constructor(readonly hasError: boolean, private readonly _value: T | null, private readonly _error: Error | null) {
    }

    // Throws an `Error` if this isn't a value.
    getValue(): T {
        if (this.hasError === true) {
            throw new Error(`'Maybe' has an error, not a value. Check 'hasError' before calling 'getValue'. Error: ${this._error}`);
        }
        return <T>this._value;
    }

    // Throws an `Error` if this isn't an error.
    getError(): Error {
        if (this._error === null) {
            throw new Error("'Maybe' has a value, not an error. Check 'hasError' before calling 'getError'.");
        }
        return this._error;
    }
}

// Either a value or `Cancelled`
export class Cancellable<T> {
    static completed<U>(value: U): Cancellable<U>;
    static completed<U extends void>(): Cancellable<U>;
    static completed<U>(maybeValue?: U): Cancellable<U> {
        const value = (maybeValue !== undefined) ? maybeValue : null;
        return new Cancellable<U>(false /*isCancelled*/, value);
    }

    private constructor(readonly isCancelled: boolean, private readonly _value: T | null) {
    }

    static cancelled<U>(): Cancellable<U> {
        return new Cancellable<U>(true /*isCancelled*/, null);
    }

    // Throws an `Error` if this isn't cancelled.
    getValue(): T {
        if (this.isCancelled === true) {
            throw new Error(`'Cancellable' is cancelled, not a value. Check 'isCancelled' before calling 'getValue'.`);
        }
        return <T>this._value;
    }
}

export enum CancellableMaybeState {
    Value,
    Error,
    Cancelled,
}

// Exactly one of a T value or an Error or Cancelled.
export class CancellableMaybe<T> {
    private static COMPLETED_VOID = new CancellableMaybe<void>(CancellableMaybeState.Value, null /*_value*/, null /*_error*/);
    private static CANCELLED = new CancellableMaybe<void>(CancellableMaybeState.Value, null /*_value*/, null /*_error*/);

    static completed<U>(value: U): CancellableMaybe<U>;
    static completed(): CancellableMaybe<void>;
    static completed<U>(maybeValue?: U): CancellableMaybe<U> {
        if (maybeValue === undefined) {
            return CancellableMaybe.COMPLETED_VOID as CancellableMaybe<U>;
        } else {
            return new CancellableMaybe<U>(CancellableMaybeState.Value, maybeValue, null /*_error*/);
        }
    }

    private constructor(
        readonly state: CancellableMaybeState,
        private readonly _value: T | null,
        private readonly _error: Error | null
    ) {
    }

    static cancelled<U>(): CancellableMaybe<U> {
        return CancellableMaybe.CANCELLED as CancellableMaybe<U>;
    }

    static error<U>(error: Error): CancellableMaybe<U> {
        return new CancellableMaybe<U>(CancellableMaybeState.Error, null /*_value*/, error);
    }

    hasValue(): boolean {
        return this.state === CancellableMaybeState.Value;
    }

    hasError(): boolean {
        return this.state === CancellableMaybeState.Error;
    }

    isCancelled(): boolean {
        return this.state === CancellableMaybeState.Cancelled;
    }

    // Throws an `Error` if this isn't a value.
    getValue(): T {
        if (this.state !== CancellableMaybeState.Value) {
            throw new Error(`'CancellableMaybeState' does not have a value (it is a ${this.state}). Check 'state' before calling 'getValue'.`);
        }
        return <T>this._value;
    }

    // Throws an `Error` if isn't an error.
    getError(): Error {
        if (this.state !== CancellableMaybeState.Error || this._error === null) {
            throw new Error(`'CancellableMaybeState' does not have an error (it is a ${this.state}). Check 'state' before calling 'getError'.`);
        }
        return this._error;
    }
}
