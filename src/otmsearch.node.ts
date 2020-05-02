interface SearchNode {}

interface DefineNode extends SearchNode {
    name: string;
}

interface ValueNode extends SearchNode {
    value: string;
}

interface OperatorNode extends SearchNode {
    operator: string;
}

class StatementNode implements SearchNode {
    public nodes: BindOperatorNode[];

    constructor() {
        this.nodes = [];
    }
    
    public toString(): string {
        return `StatementNode{ nodes: [${this.nodes.join(",")}] }`;
    }
}

class PatternNode implements SearchNode {
    public nodes: (BindOperatorNode | StatementNode)[];

    constructor() {
        this.nodes = [];
    }
    
    public toString(): string {
        return `ArrayNode{ nodes: [${this.nodes.join(",")}] }`;
    }
}

class KeyNameNode implements DefineNode {
    public name: string;
    public isArray: boolean;
    constructor(name: string) {
        const index = name.indexOf("[]");
        if (index !== -1) {
            this.name = name.substring(0, index);
            this.isArray = true;
        }
        else {
            this.name = name;
            this.isArray = false;
        }
    }

    public toString(): string {
        return `KeywordNode{ node: ${this.name}, isArray: ${this.isArray} }`;
    }
}

class VariableNode implements DefineNode, ValueNode {
    public name: string;

    constructor(name: string) {
        this.name = name;
    }

    public get value() {
        return this.name;
    }

    public set value(name: string) {
        this.name = name;
    }

    public toString(): string {
        return `VariableNode{ name: ${this.name} }`;
    }
}

class KeywordVariableNode implements ValueNode {
    public value: string;

    constructor(value: string) {
        this.value = value;
    }

    public toString(): string {
        return `KeywordVariableNode{ value: ${this.value} }`;
    }
}

class StringNode implements ValueNode {
    constructor(public value: string) {}

    public toString(): string {
        return `StringNode{ value: ${this.value} }`;
    }
}

class NumberNode implements ValueNode {
    constructor(public value: string) {}

    public toString(): string {
        return `NumberNode{ value: ${this.value} }`;
    }
}

class BinaryOperatorNode implements OperatorNode {
    public rhs: ValueNode | OperatorNode | null;
    public lhs: ValueNode | OperatorNode | null;

    constructor(public operator: string) {
        this.lhs = null;
        this.rhs = null;
    }

    public toString(): string {
        return `BinaryOperatorNode{ operator: "${this.operator}", lhs: ${this.lhs}, rhs: ${this.rhs} }`;
    }
}

class UnaryOperatorNode implements OperatorNode {
    public node: ValueNode | OperatorNode | null;
    constructor(public operator: string) {
        this.node = null;
    }

    public toString(): string {
        return `UnaryOperatorNode{ operator: "${this.operator}", node: ${this.node} }`;
    }
}

class BindOperatorNode implements OperatorNode {
    public lhs: VariableNode | KeyNameNode | null;
    public rhs: StatementNode | PatternNode | MatchingOperatorNode | OperatorNode | null;
    public readonly operator: string;

    constructor() {
        this.operator = ":";
        this.lhs = null;
        this.rhs = null;
    }

    public toString(): string {
        return `BindOperatorNode{ lhs: ${this.lhs}, rhs: ${this.rhs} }`;
    }
}

type MatchingType = 0 | 1 | 2 | 3;
class MatchingOperatorNode implements OperatorNode {
    public node: ValueNode | OperatorNode | null;
    public matchType: MatchingType;

    constructor() {
        this.matchType = MatchingOperatorNode.PARTIAL;
        this.node = null;
    }

    public get operator() {
        return MatchingOperatorNode.MatchingValue.get(this.matchType)!;
    }

    public set operator(value: string) {
        let result = MatchingOperatorNode.PARTIAL;
        for (const keyValue of MatchingOperatorNode.MatchingValue.entries()) {
            if (keyValue[1] === value) {
                result = keyValue[0];
                break;
            }
        } 

        this.matchType = result;
    }

    public toString(): string {
        let matchType: string = this.operator;

        return `MatchingOperatorNode{ matchType: "${matchType}", node: ${this.node} }`;
    }

    public static PARTIAL: MatchingType = 0;
    public static FORWARD: MatchingType = 1;
    public static BACKWARD: MatchingType = 2;
    public static EXACT: MatchingType = 3;

    private static MatchingValue = new Map<MatchingType, string>([
        [0, "partial"], [1, "forward"],
        [2, "backward"], [3, "exact"],
    ]);
}

class BraceNode implements OperatorNode {
    public node: OperatorNode | null;
    public readonly operator: string;

    constructor() {
        this.node = null;
        this.operator = "()";
    }
    
    public toString(): string {
        return `BraceNode{ node: ${this.node} }`;
    }
}
