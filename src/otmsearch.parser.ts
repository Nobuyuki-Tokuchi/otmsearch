import * as Token from "./otmsearch.token";
import * as Node from "./otmsearch.node";

export default class OtmSearchParser {
    private node: Node.SearchNode;

    constructor() {
        this.node = null!;
    }

    public parse(tokens: Token.SearchToken[]): Node.SearchNode {
        this.node = this.parsePattern(tokens, 0)[0];
        return this.node;
    }

    private parsePattern(tokens: Token.SearchToken[], count: number): [Node.BindOperatorNode | Node.StatementNode | Node.PatternNode, number] {
        let token = tokens[count];
        const hasBrace = token instanceof Token.PatternBraceToken && token.tokenValue === "[";
        let pattern: Node.BindOperatorNode | Node.StatementNode | Node.PatternNode;

        if (hasBrace) {
            count++;
            token = tokens[count];

            pattern = new Node.PatternNode();
            let node: Node.BindOperatorNode | Node.StatementNode;

            while (count < tokens.length && !(token instanceof Token.PatternBraceToken && token.tokenValue === "]")) {
                if (pattern.nodes.length > 0) {
                    if (!(token instanceof Token.CommaToken)) {
                        throw new SyntaxError(`required to ',' in pattern): ${token}, row:${token.row}, column:${token.column}`);
                    }
                    count++;
                }

                [node, count] = this.parseStatement(tokens, count);
                pattern.nodes.push(node);

                token = tokens[count];
            }

            if (!(token instanceof Token.PatternBraceToken && token.tokenValue === "]")) {
                throw new SyntaxError(`invalid token (end pattern): ${token}, row:${token.row}, column:${token.column}`);
            }
            count++;
        }
        else {
            [pattern, count] = this.parseStatement(tokens, count);
        }

        return [pattern, count];
    }

    private parseStatement(tokens: Token.SearchToken[], count: number): [Node.BindOperatorNode | Node.StatementNode, number] {
        let token = tokens[count];
        const hasBrace = token instanceof Token.StatementBraceToken && token.tokenValue === "{";
        let statement: Node.BindOperatorNode | Node.StatementNode;

        if (hasBrace) {
            count++;
            token = tokens[count];
            statement = new Node.StatementNode();
            let node;

            while (count < tokens.length && !(token instanceof Token.StatementBraceToken && token.tokenValue === "}")) {
                if (statement.nodes.length > 0) {
                    if (!(token instanceof Token.CommaToken)) {
                        throw new SyntaxError(`required to ',' in statement): ${token}, row:${token.row}, column:${token.column}`);
                    }
                    count++;
                }
                [node, count] = this.parseDefine(tokens, count);
                statement.nodes.push(node);

                token = tokens[count];
            }

            token = tokens[count];
            if (!(token instanceof Token.StatementBraceToken && token.tokenValue === "}")) {
                throw new SyntaxError(`invalid token (end statement): ${token}, row:${token.row}, column:${token.column}`);
            }
            count++;
        }
        else {
            [statement, count] = this.parseDefine(tokens, count);
        }

        return [statement, count];
    }

    private parseDefine(tokens: Token.SearchToken[], count: number): [Node.BindOperatorNode, number] {
        const keyName = tokens[count];
        
        if(!(keyName instanceof Token.KeyNameToken) && !(keyName instanceof Token.VariableToken)) {
            throw new SyntaxError(`invalid token in define: ${keyName}, row:${keyName.row}, column:${keyName.column}`);
        }
        count++;

        let token = tokens[count];
        if (!(token instanceof Token.BindToken)) {
            throw new SyntaxError(`require ':' after '${keyName}', row:${token.row}, column:${token.column}`);
        }
        count++;

        const node = new Node.BindOperatorNode();

        if (keyName instanceof Token.KeyNameToken) {
            let point;
            const names = keyName.name.split(".");
            const regexp = /^[A-Za-z_][A-Za-z0-9_]*(\?)?(\[\])?$/;

            if (!names[0].match(regexp)) {
                throw new SyntaxError(`invalid keyName: ${names[0]}, row:${keyName.row}, column:${keyName.column}`);
            }
            
            node.lhs = new Node.KeyNameNode(names[0]);
            if (names.length > 1) {
                point = node;
                for (let i = 1; i < names.length; i++) {
                    const branch = new Node.BindOperatorNode();
                    if (!names[i].match(regexp)) {
                        throw new SyntaxError(`invalid keyName: ${names[i]}, row:${keyName.row}, column:${keyName.column}`);
                    }
                    branch.lhs = new Node.KeyNameNode(names[i]);
    
                    point.rhs = branch;
                    point = branch;
                }
            }
            else {
                point = node;
            }

            token = tokens[count];
            if (token instanceof Token.StatementBraceToken) {
                [point.rhs, count] = this.parseStatement(tokens, count);
            }
            else if (token instanceof Token.PatternBraceToken) {
                [point.rhs, count] = this.parsePattern(tokens, count);
            }
            else {
                [point.rhs, count] = this.parseMatching(tokens, count);
            }
        }
        else {
            node.lhs = new Node.VariableNode(keyName.name);
            [node.rhs, count] = this.parseMatching(tokens, count);
        }

        return [node, count];
    }

    private parseMatching(tokens: Token.SearchToken[], count: number): [Node.MatchingOperatorNode, number] {
        let token = tokens[count];
        const fix = new Node.MatchingOperatorNode();

        if(token instanceof Token.MatchingOperatorToken) {
            if(token.operator === Token.MatchingOperatorToken.FORWARD_MATCHIND) {
                fix.matchType = Node.MatchingOperatorNode.FORWARD;
                count++;
            }
            else {
                throw new SyntaxError(`invalid matching token: ${token}, row:${token.row}, column:${token.column}`);
            }
        }
        else {
            fix.matchType = Node.MatchingOperatorNode.PARTIAL;
        }

        [fix.node, count] = this.parseOr(tokens, count);

        token = tokens[count];
        if(token instanceof Token.MatchingOperatorToken) {
            if(token.operator === Token.MatchingOperatorToken.BACKWARD_MATCHIND) {
                if(fix.matchType === Node.MatchingOperatorNode.PARTIAL) {
                    fix.matchType = Node.MatchingOperatorNode.BACKWARD;
                }
                else {
                    fix.matchType = Node.MatchingOperatorNode.EXACT;
                }
                count++;
            }
            else {
                throw new SyntaxError(`invalid matching token: ${token}, row:${token.row}, column:${token.column}`);
            }
        }

        return [fix,count];
    }

    private parseOr(tokens: Token.SearchToken[], count: number): [Node.ValueNode | Node.OperatorNode, number] {
        let node: Node.ValueNode | Node.OperatorNode;
        [node, count] = this.parseAnd(tokens, count); 

        while (count < tokens.length) {
            const token = tokens[count];

            if(token instanceof Token.BinaryOperatorToken && token.operator === "or") {
                const operator = new Node.BinaryOperatorNode("or");
                operator.lhs = node;
                [operator.rhs, count] = this.parseAnd(tokens, count + 1);

                node = operator;
            }
            else {
                return [node, count];
            }
        }

        return [node, count];
    }

    private parseAnd(tokens: Token.SearchToken[], count: number): [Node.ValueNode | Node.OperatorNode, number] {
        let node: Node.ValueNode | Node.OperatorNode;
        if(tokens[count] instanceof Token.UnaryOperatorToken) {
            [node, count] = this.parseNot(tokens, count); 
        }
        else {
            [node, count] = this.parseCompare(tokens, count);
        }

        while (count < tokens.length) {
            const token = tokens[count];

            if(token instanceof Token.BinaryOperatorToken && token.operator === "and") {
                const operator = new Node.BinaryOperatorNode("and");
                operator.lhs = node;

                count++;
                if(tokens[count] instanceof Token.UnaryOperatorToken) {
                    [node, count] = this.parseNot(tokens, count); 
                }
                else {
                    [node, count] = this.parseCompare(tokens, count);
                }
                operator.rhs = node;
        
                node = operator;
            }
            else {
                return [node, count];
            }
        }

        return [node, count];
    }

    private parseNot(tokens: Token.SearchToken[], count: number): [Node.ValueNode | Node.OperatorNode, number] {
        const token = tokens[count];
        let node: Node.ValueNode | Node.OperatorNode;

        if (token instanceof Token.UnaryOperatorToken && token.operator === "not") {
            node = new Node.UnaryOperatorNode("not");
            [(node as Node.UnaryOperatorNode).node, count] = this.parseData(tokens, count + 1);

            return [node, count];
        }
        else {
            return this.parseData(tokens, count);
        }
    }

    private parseCompare(tokens: Token.SearchToken[], count: number): [Node.ValueNode | Node.OperatorNode, number] {
        let node: Node.ValueNode | Node.OperatorNode;
        [node, count] = this.parseData(tokens, count); 
        const token = tokens[count];
        let operator: Node.BinaryOperatorNode;

        if(token instanceof Token.BinaryOperatorToken) {
            switch(token.operator) {
                case "<":
                case ">":
                case "==":
                case "!=":
                case "<=":
                case ">=":
                    operator = new Node.BinaryOperatorNode(token.operator);
                    operator.lhs = node;
                    [operator.rhs, count] = this.parseData(tokens, count + 1);
    
                    node = operator;
                    break;
            }
        }

        return [node, count];
    }

    private parseData(tokens: Token.SearchToken[], count: number): [Node.ValueNode | Node.OperatorNode, number] {
        const token = tokens[count];
        let node: Node.ValueNode | Node.OperatorNode;
        
        if (token instanceof Token.BraceToken) {
            if(token.tokenValue === "(") {
                const brace = new Node.BraceNode();
                [brace.node, count] = this.parseMatching(tokens, count + 1);

                const next = tokens[count];
                if(!(next instanceof Token.BraceToken && next.tokenValue === ")")) {
                    throw new SyntaxError(`not found ')'. got ${next}, row:${next.row}, column:${next.column}`);
                }
                node = brace;
            }
            else {
                throw new SyntaxError(`invalid token in data: ${token}, row:${token.row}, column:${token.column}`);
            }
        }
        else if (token instanceof Token.KeywordVariableToken) {
            node = new Node.KeywordVariableNode(token.name);
        }
        else if (token instanceof Token.VariableToken) {
            node = new Node.VariableNode(token.name);
        } 
        else if (token instanceof Token.NumberToken) {
            node = new Node.NumberNode(token.value);
        }
        else if (token instanceof Token.StringToken) {
            node = new Node.StringNode(token.value);
        }
        else {
            throw new SyntaxError(`invalid token in data: ${token}, row:${token.row}, column:${token.column}`);
        }

        return [node, count + 1];
    }
}