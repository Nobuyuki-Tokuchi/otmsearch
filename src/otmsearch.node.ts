interface SearchNode {}

class KeyNameNode implements SearchNode {
    constructor(public name: string) {}

    public toString(): string {
        return `KeywordNode{ node: ${this.name} }`;
    }
}

class VariableNode implements SearchNode {
    constructor(public name: string) {}

    public toString(): string {
        return `VariableNode{ node: ${this.name} }`;
    }
}

class ValueNode implements SearchNode {
    constructor(public value: string) {}

    public toString(): string {
        return `ValueNode{ value: ${this.value} }`;
    }
}

class NumberNode implements SearchNode {
    constructor(public value: string) {}

    public toString(): string {
        return `NumberNode{ value: ${this.value} }`;
    }
}

class BinaryOperatorNode implements SearchNode {
    public rhs: SearchNode | null;
    public lhs: SearchNode | null;

    constructor(public operator: string) {
        this.lhs = null;
        this.rhs = null;
    }

    public toString(): string {
        return `BinaryOperatorNode{ operator: "${this.operator}", lhs: ${this.lhs}, rhs: ${this.rhs} }`;
    }
}

class UnaryOperatorNode implements SearchNode {
    public node: SearchNode | null;
    constructor(public operator: string) {
        this.node = null;
    }

    public toString(): string {
        return `UnaryOperatorNode{ operator: "${this.operator}", node: ${this.node} }`;
    }
}

class BindOperatorNode implements SearchNode {
    public lhs: KeyNameNode | null;
    public rhs: SearchNode | null;

    constructor() {
        this.lhs = null;
        this.rhs = null;
    }

    public toString(): string {
        return `BindOperatorNode{ lhs: ${this.lhs}, rhs: ${this.rhs} }`;
    }
}

type MatchingType = 0 | 1 | 2 | 3;
class MatchingOperatorNode implements SearchNode {
    public node: SearchNode | null;
    public matchType: MatchingType;
    constructor() {
        this.matchType = MatchingOperatorNode.PARTIAL;
        this.node = null;
    }

    public toString(): string {
        let matchType;
        switch(this.matchType) {
            case MatchingOperatorNode.PARTIAL:
                matchType = "partial";
                break;
            case MatchingOperatorNode.FORWARD:
                matchType = "forward";
                break;
            case MatchingOperatorNode.BACKWARD:
                matchType = "backward";
                break;
            case MatchingOperatorNode.EXACT:
                matchType = "exact";
                break;
            default:
                matchType = "partial";
                break;
        }
        return `MatchingOperatorNode{ matchType: "${matchType}", node: ${this.node} }`;
    }

    public static PARTIAL: MatchingType = 0;
    public static FORWARD: MatchingType = 1;
    public static BACKWARD: MatchingType = 2;
    public static EXACT: MatchingType = 3;
}

class BraceNode implements SearchNode {
    public node: SearchNode | null;
    constructor() {
        this.node = null;
    }
    
    public toString(): string {
        return `BraceNode{ node: ${this.node} }`;
    }

}