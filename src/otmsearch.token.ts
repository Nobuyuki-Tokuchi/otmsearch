interface SearchToken {}

interface ValueToken extends SearchToken {
    value: string;
}

interface OperatorToken extends SearchToken {
    operator: string;
}

class KeyNameToken implements SearchToken {
    constructor(public name: string) {}

    public toString(): string {
        return `KeyNameToken{ name: '${this.name}' }`;
    }
}

class VariableToken implements SearchToken {
    constructor(public name: string) {}

    public toString(): string {
        return `VariableToken{ name: '${this.name}' }`;
    }
}

class KeywordVariableToken implements SearchToken {
    constructor(public name: string) {}

    public toString(): string {
        return `KeywordVariableToken{ name: '${this.name}' }`;
    }
}

class StringToken implements ValueToken {
    constructor(public value: string) {}

    public toString(): string {
        return `StringToken{ value: '${this.value}' }`;
    }
}

class NumberToken implements ValueToken {
    constructor(public value: string) {}

    public toString(): string {
        return `NumberToken{ value: '${this.value}' }`;
    }
}

class BinaryOperatorToken implements OperatorToken {
    constructor(public operator: string) {}

    public toString(): string {
        return `BinaryOperatorToken{ operator: '${this.operator}' }`;
    }
}

class UnaryOperatorToken implements OperatorToken {
    constructor(public operator: string) {}

    public toString(): string {
        return `UnaryOperatorToken{ operator: '${this.operator}' }`;
    }
}

type MatchindType = "^" | "$";
class MatchingOperatorToken implements OperatorToken {
    constructor(public operator: MatchindType) {}

    public toString(): string {
        return `MatchingOperatorToken{ operator: '${this.operator}' }`;
    }

    public static readonly FORWARD_MATCHIND: string = "^";
    public static readonly BACKWARD_MATCHIND: string = "$";
}

type BraceString = "(" | ")";
class BraceToken implements SearchToken {
    constructor(public tokenValue: BraceString) {}

    public toString(): string {
        return `BraceToken{ value: '${this.tokenValue}' }`;
    }
}

type PatternString = "[" | "]";
class PatternBraceToken implements SearchToken {
    constructor(public tokenValue: PatternString) {}

    public toString(): string {
        return `ArrayBraceToken{ value: '${this.tokenValue}' }`;
    }
}

type StatementString = "{" | "}";
class StatementBraceToken implements SearchToken {
    constructor(public tokenValue: StatementString) {}

    public toString(): string {
        return `StateBraceToken{ value: '${this.tokenValue}' }`;
    }
}

class CommaToken implements SearchToken {
    constructor() {}

    public toString(): string {
        return "CommaToken";
    }
}

class BindToken implements OperatorToken {
    operator: string;

    constructor() {
        this.operator = ":";
    }

    public toString(): string {
        return "BindToken";
    }
}
