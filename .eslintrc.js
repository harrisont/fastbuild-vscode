/**@type {import('eslint').Linter.Config} */
// eslint-disable-next-line no-undef
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        'semi': ['error', 'always'],
        'indent': ['error', 4, { 'SwitchCase': 1 } ],
        '@typescript-eslint/no-explicit-any': 0,
    }
};