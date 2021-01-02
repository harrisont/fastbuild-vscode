import * as assert from 'assert';

import {
    Struct,
    Value,
} from '../evaluator';

import {
    valueToString,
} from '../features/hoversProvider';

describe('hoversProvider', () => {
    describe('valueToString', () => {
        it('works for an integer', () => {
            const str = valueToString(1);
            assert.strictEqual('1', str);
        });

        it('works for a boolean', () => {
            const str = valueToString(true);
            assert.strictEqual('true', str);
        });
        
        it('works for a string', () => {
            const str = valueToString('Hello world');
            assert.strictEqual('"Hello world"', str);
        });
        
        it('works for an empty array', () => {
            const value: Value = [];
            const str = valueToString(value);
            assert.strictEqual(
                `{
}`,
                str);
        });
        
        it('works for an array of primitives', () => {
            const value = ['Hello', 'world'];
            const str = valueToString(value);
            assert.strictEqual(
                `{
    "Hello"
    "world"
}`,
                str);
        });
        
        it('works for an array of arrays', () => {
            const value = [
                [
                    0,
                    1,
                ],
                [
                    10,
                    11,
                ]
            ];
            const str = valueToString(value);
            assert.strictEqual(
                `{
    {
        0
        1
    }
    {
        10
        11
    }
}`,
                str);
        });
        
        it('works for an empty struct', () => {
            const value = new Struct();
            const str = valueToString(value);
            assert.strictEqual(
                `[
]`,
                str);
        });
        
        it('works for a struct', () => {
            const value = new Struct(Object.entries({
                A: 1,
                B: 2
            }));
            const str = valueToString(value);
            assert.strictEqual(
                `[
    .A = 1
    .B = 2
]`,
                str);
        });
        
        it('works for a struct of structs', () => {
            const value = new Struct(Object.entries({
                A: new Struct(Object.entries({
                    A1: 1,
                    A2: 2
                })),
                B: new Struct(Object.entries({
                    B1: 1,
                    B2: 2
                }))
            }));
            const str = valueToString(value);
            assert.strictEqual(
                `[
    .A = [
        .A1 = 1
        .A2 = 2
    ]
    .B = [
        .B1 = 1
        .B2 = 2
    ]
]`,
                str);
        });
    });
});