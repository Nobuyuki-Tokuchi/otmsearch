interface SearchToken {}

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

class ValueToken implements SearchToken {
    constructor(public value: string) {}

    public toString(): string {
        return `ValueToken{ value: '${this.value}' }`;
    }
}

class NumberToken implements SearchToken {
    constructor(public value: string) {}

    public toString(): string {
        return `NumberToken{ value: '${this.value}' }`;
    }
}

class BinaryOperatorToken implements SearchToken {
    constructor(public operator: string) {}

    public toString(): string {
        return `BinaryOperatorToken{ operator: '${this.operator}' }`;
    }
}

class UnaryOperatorToken implements SearchToken {
    constructor(public operator: string) {}

    public toString(): string {
        return `UnaryOperatorToken{ operator: '${this.operator}' }`;
    }
}


type MatchindType = "^" | "$";
class MatchingOperatorToken implements SearchToken {
    constructor(public operator: MatchindType) {}

    public toString(): string {
        return `MatchingOperatorToken{ operator: '${this.operator}' }`;
    }

    public static readonly FORWARD_MATCHIND: string = "^";
    public static readonly BACKWARD_MATCHIND: string = "$";
}

class BraceToken implements SearchToken {
    constructor(public value: string) {}

    public toString(): string {
        return `BraceToken{ value: ${this.value} }`;
    }
}

class SemicolonToken implements SearchToken {
    constructor() {}

    public toString(): string {
        return "SemicolonToken";
    }
}

class ColonToken implements SearchToken {
    constructor() {}

    public toString(): string {
        return "ColonToken";
    }
}

class BindToken implements SearchToken {
    constructor() {}

    public toString(): string {
        return "BindToken";
    }
}
