export interface SearchToken {
    row: number;
    column: number;
}

export interface ValueToken extends SearchToken {
    value: string;
}

export interface OperatorToken extends SearchToken {
    operator: string;
}

export class KeyNameToken implements SearchToken {
    constructor(public name: string, public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `KeyNameToken{ name: '${this.name}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class VariableToken implements SearchToken {
    constructor(public name: string, public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `VariableToken{ name: '${this.name}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class KeywordVariableToken implements SearchToken {
    constructor(public name: string, public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `KeywordVariableToken{ name: '${this.name}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class StringToken implements ValueToken {
    constructor(public value: string, public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `StringToken{ value: '${this.value}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class NumberToken implements ValueToken {
    constructor(public value: string, public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `NumberToken{ value: '${this.value}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class BinaryOperatorToken implements OperatorToken {
    constructor(public operator: string, public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `BinaryOperatorToken{ operator: '${this.operator}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class UnaryOperatorToken implements OperatorToken {
    constructor(public operator: string, public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `UnaryOperatorToken{ operator: '${this.operator}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class MatchingOperatorToken implements OperatorToken {
    constructor(public operator: "^" | "$", public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `MatchingOperatorToken{ operator: '${this.operator}', row: ${this.row}, column: ${this.column} }`;
    }

    public static readonly FORWARD_MATCHIND: string = "^";
    public static readonly BACKWARD_MATCHIND: string = "$";
}

export class BraceToken implements SearchToken {
    constructor(public tokenValue: "(" | ")", public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `BraceToken{ value: '${this.tokenValue}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class PatternBraceToken implements SearchToken {
    constructor(public tokenValue: "[" | "]", public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `ArrayBraceToken{ value: '${this.tokenValue}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class StatementBraceToken implements SearchToken {
    constructor(public tokenValue: "{" | "}", public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `StateBraceToken{ value: '${this.tokenValue}', row: ${this.row}, column: ${this.column} }`;
    }
}

export class CommaToken implements SearchToken {
    constructor(public readonly row: number, public readonly column: number) { }

    public toString(): string {
        return `CommaToken{ row: ${this.row}, column: ${this.column} }`;
    }
}

export class BindToken implements OperatorToken {
    operator: string;

    constructor(public readonly row: number, public readonly column: number) {
        this.operator = ":";
    }

    public toString(): string {
        return `BindToken{ row: ${this.row}, column: ${this.column} }`;
    }
}
