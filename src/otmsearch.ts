import * as Node from "./otmsearch.node";
import * as Token from "./otmsearch.token";

export default class OtmSearch {
    private code: string;
    private tokens: Token.SearchToken[];
    private node: Node.SearchNode | null;
    private variables: Map<string, Node.MatchingOperatorNode>;
    private translatedCode: string;
    private func?: Function;

    constructor(code: string) {
        this.code = code;
        this.tokens = [];
        this.node = null;
        this.variables = new Map<string, Node.MatchingOperatorNode>();
        this.translatedCode = "";
    }

    public compile(): Function {
        if(typeof(this.func) === "undefined") {
            this.tokens = this.tokenize();
            this.node = this.parse(this.tokens);
            this.func = this.translate(this.node ?? new Node.PatternNode());
        }
        return this.func;
    }

    private tokenize(): Token.SearchToken[] {
        const list: Token.SearchToken[] = [];
        let buffer = "";
        let row = 1;
        let column = 0;

        const append = () => {
            if (buffer.length > 0) {
                if (OtmSearch.KEYWORDS.indexOf(buffer) !== -1) {
                    switch(buffer) {
                        case "not":
                            list.push(new Token.UnaryOperatorToken(buffer, row, column - buffer.length));
                            break;
                        default:
                            list.push(new Token.BinaryOperatorToken(buffer, row, column - buffer.length));
                            break;
                    }
                }
                else if (buffer[0] == "%") {
                    if (buffer.match(/^%[A-Za-z_][A-Za-z0-9_]*$/)) {
                        list.push(new Token.KeywordVariableToken(buffer.substring(1), row, column - buffer.length));
                    }
                    else {
                        throw new SyntaxError(`invalid token: ${buffer}, row:${row}, column:${column}`);
                    }
                }
                else if (buffer[0] === "@") {
                    if (buffer.match(/^@[A-Za-z_][A-Za-z0-9_]*$/)) {
                        list.push(new Token.VariableToken(buffer.substring(1), row, column - buffer.length));
                    }
                    else {
                        throw new SyntaxError(`invalid token: ${buffer}, row:${row}, column:${column}`);
                    }
                }
                else if (buffer.match(/^".+"$/)) {
                    list.push(new Token.StringToken(buffer.substring(1, buffer.length - 1), row, column - buffer.length));
                }
                else if (buffer.match(/^\d+$/)) {
                    list.push(new Token.NumberToken(buffer, row, column - buffer.length));
                }
                else {
                    list.push(new Token.KeyNameToken(buffer, row, column - buffer.length));
                }
            }

            buffer = "";
        };

        let isString = false;
        const escapeTable = new Map<string, string>();
        escapeTable.set("'", "'");
        escapeTable.set("\\", "\\");
        escapeTable.set("r", "\r");
        escapeTable.set("n", "\n");
        escapeTable.set("v", "\v");
        escapeTable.set("t", "\t");
        escapeTable.set("b", "\b");
        escapeTable.set("f", "\f");
        escapeTable.set("\"", "\"");

        for (let i = 0; i < this.code.length; i++) {
            const c = this.code[i];
            if(isString) {
                if (c === "\r" || c === "\n") {
                    throw new SyntaxError(`invalid token in string: ${c}, row:${row}, column:${column}`);
                }

                if (c === '\\') {
                    i++;
                    column++;
                    
                    const next = this.code[i];
                    if (escapeTable.has(next)) {
                        buffer += escapeTable.get(next);
                        column++;
                    }
                    else if (next === "x") {
                        i++;
                        column++;

                        const hex = this.code.substring(i, i + 2);
                        if (hex.match(/[0-9A-Fa-f]+/)) {
                            buffer += String.fromCharCode(parseInt(hex, 16));
                            i += 2;
                            column += 2;
                        }
                        else {
                            throw new SyntaxError(`invalid token in string: \\x${hex}, row:${row}, column:${column}`);
                        }
                    }
                    else if (next === "u") {
                        i++;
                        column++;

                        if (this.code[i] === "{") {
                            i++;
                            column++;

                            const index = this.code.indexOf("}", i);
                            const hex = this.code.substring(i, index);
                            if (hex.match(/[0-9A-Fa-f]+/)) {
                                buffer += String.fromCharCode(parseInt(hex, 16));
                                i = index + 1;
                                column += index + 1;
                            }
                            else {
                                throw new SyntaxError(`invalid token in string: \\u{${hex}}, row:${row}, column:${column}`);
                            }
                        }
                        else {
                            const hex = this.code.substring(i, i + 4);
                            if (hex.match(/[0-9A-Fa-f]+/)) {
                                buffer += String.fromCharCode(parseInt(hex, 16));
                                i += 4;
                                column += 4;
                            }
                            else {
                                throw new SyntaxError(`invalid token in string: \\u${hex}, row:${row}, column:${column}`);
                            }
                        }
                    }
                }
                else if(c === "\"") {
                    buffer += c;
                    append();
                    isString = false;
                    column++;
                }
                else {
                    buffer += c;
                    column++;
                }
            }
            else {
                let last: Token.SearchToken;

                switch (c) {
                    case " ":
                    case "\t":
                        append();
                        column++;
                        break;
                    case "\n":
                        append();
                        row++;
                        column = 0;
                        break;
                    case "\r":
                        append();
                        if (this.code[i + 1] === "\n") {
                            i++;
                        }
                        row++;
                        column = 0;
                        break;
                    case "#":
                        append();
                        while(i < this.code.length && this.code[i] !== "\r" && this.code[i] !== "\n") {
                            i++;
                        }
                        if (this.code[i] === "\r" || this.code[i] === "\n") {
                            i--;
                        }
                        break;
                    case "&":
                        append();
                        list.push(new Token.BinaryOperatorToken("and", row, column));
                        column++;
                        break;
                    case "|":
                        append();
                        list.push(new Token.BinaryOperatorToken("or", row, column));
                        column++;
                        break;
                    case "=":
                        if(this.code[i + 1] === "=") {
                            append();
                            list.push(new Token.BinaryOperatorToken("==", row, column));
                            i++;
                            column += 2;
                        }
                        else {
                            throw new SyntaxError(`invalid token (tokenizer): ${c}, row:${row}, column:${column}`);
                        }
                        break;
                    case ":":
                        append();
                        list.push(new Token.BindToken(row, column));
                        column++;
                        break;
                    case "<":
                    case ">":
                        if(this.code[i + 1] === "=") {
                            append();
                            list.push(new Token.BinaryOperatorToken(c + "=", row, column));
                            i++;
                            column += 2;
                        }
                        else {
                            append();
                            list.push(new Token.BinaryOperatorToken(c, row, column));
                            column++;
                        }
                        break;
                    case "!":
                        if(this.code[i + 1] === "=") {
                            append();
                            list.push(new Token.BinaryOperatorToken("!=", row, column));
                            i++;
                            column += 2;
                        }
                        else {
                            append();
                            list.push(new Token.UnaryOperatorToken("not", row, column));
                            column++;
                        }
                        break;
                    case "^":
                    case "$":
                        append();
                        list.push(new Token.MatchingOperatorToken(c, row, column));
                        column++;
                        break;
                    case "(":
                    case ")":
                        append();
                        list.push(new Token.BraceToken(c, row, column));
                        column++;
                        break;
                    case "{":
                    case "}":
                        append();
                        list.push(new Token.StatementBraceToken(c, row, column));
                        column++;
                        break;
                    case "[":
                        append();
                        last = list[list.length - 1];
                        if (last instanceof Token.KeyNameToken) {
                            i++;
                            const next = this.code[i];
                            if (next !== "]") {
                                throw new SyntaxError(`invalid token (tokenizer): ${last.name + c + next}, row:${row}, column:${column}`);
                            }

                            list.pop();
                            buffer = last.name + "[]";
                            column += 2;
                        }
                        else {
                            list.push(new Token.PatternBraceToken(c, row, column));
                            column++;
                        }
                        break;
                    case "]":
                        append();
                        list.push(new Token.PatternBraceToken(c, row, column));
                        column++;
                        break;
                    case ",":
                        append();
                        list.push(new Token.CommaToken(row, column));
                        column++;
                        break;
                    case "\"":
                        append();
                        buffer += c;
                        isString = true;
                        column++;
                        break;
                    default:
                        buffer += c;
                        column++;
                        break;
                }
            }
        }
        append();

        return list;
    }

    private parse(tokens: Token.SearchToken[]): Node.SearchNode {
        return this.parsePattern(tokens, 0)[0];
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

    private translate(node: Node.SearchNode): Function {
        let count = 0;

        if (node instanceof Node.StatementNode) {
            this.translatedCode = this.translateStatement(node, "x" + count, count);
        }
        else if (node instanceof Node.PatternNode) {
            this.translatedCode = this.translatePattern(node, "x" + count, count);
        }
        else if (node instanceof Node.BindOperatorNode) {
            count++;
            this.translatedCode = this.translateBinding(node, "x" + count, count);
        }
        else {
            throw new SyntaxError(`invalid root node ${node}`);
        }

        return new Function("x" + count, `return ${this.translatedCode};`);
    }

    private translateStatement(node: Node.StatementNode, targetName: string, depth: number): string {
        let code = "";
        for (const state of node.nodes) {
            if (code.length) { code += " && "; }

            if (state.lhs instanceof Node.VariableNode) {
                if (state.lhs === null) {
                    throw new SyntaxError(`invalid node in binding variable: ${state.rhs}`);
                }
                this.variables.set(state.lhs.name, state.rhs as Node.MatchingOperatorNode);
            }
            else if (state.rhs instanceof Node.MatchingOperatorNode) {
                const matching = state.rhs
                if (matching.node instanceof Node.StringNode) {
                   code += this.translateBinding(state, targetName, depth);
                }
                else if (matching.node instanceof Node.BinaryOperatorNode && matching.node.operator !== "or") {
                    code += this.translateBinding(state, targetName, depth);
                }
                else if (matching.node instanceof Node.BraceNode) {
                    code += this.translateBinding(state, targetName, depth);
                }
                else if (matching.node instanceof Node.UnaryOperatorNode && matching.node.operator === "not") {
                    code += this.translateBinding(state, targetName, depth);
                }
                else if (node.nodes.length === 1) {
                    code += this.translateBinding(state, targetName, depth);
                }
                else {
                    code += "(" + this.translateBinding(state, targetName, depth) + ")";
                }
            }
            else {
                code += "(" + this.translateBinding(state, targetName, depth) + ")";
            }
        }

        return code;
    }

    private translatePattern(node: Node.PatternNode, targetName: string, depth: number): string {
        let code = "";
        for (const pattern of node.nodes) {
            if (code.length) { code += " || "; }

            if (pattern instanceof Node.BindOperatorNode) {
                if (pattern.lhs instanceof Node.VariableNode) {
                    if (pattern.lhs === null) {
                        throw new SyntaxError(`invalid node in binding variable: ${pattern.rhs}`);
                    }
                    this.variables.set(pattern.lhs.name, pattern.rhs as Node.MatchingOperatorNode);
                }
                else if (pattern.rhs instanceof Node.MatchingOperatorNode) {
                    const matching = pattern.rhs
                    if (matching.node instanceof Node.StringNode) {
                       code += this.translateBinding(pattern, targetName, depth);
                    }
                    else if (matching.node instanceof Node.BinaryOperatorNode) {
                        code += this.translateBinding(pattern, targetName, depth);
                    }
                    else if (matching.node instanceof Node.BraceNode) {
                        code += this.translateBinding(pattern, targetName, depth);
                    }
                    else if (matching.node instanceof Node.UnaryOperatorNode && matching.node.operator === "not") {
                        code += this.translateBinding(pattern, targetName, depth);
                    }
                    else if (node.nodes.length === 1) {
                        code += this.translateBinding(pattern, targetName, depth);
                    }
                    else {
                        code += "(" + this.translateBinding(pattern, targetName, depth) + ")";
                    }
                }
                else {
                    code += "(" + this.translateBinding(pattern, targetName, depth) + ")";
                }
            }
            else {
                code += "(" + this.translateStatement(pattern, targetName, depth) + ")";
            }
        }

        return code;
    }

    private translateBinding(node: Node.BindOperatorNode, targetName: string, depth: number): string {
        let code = "";

         if (node.lhs instanceof Node.KeyNameNode) {
            let newTarget: string;

            if (node.lhs.isArray) {
                newTarget = "x" + (depth + 1);

                if (node.lhs.isOptional) {
                    code += "("+ targetName +"."+ node.lhs.name + "?." + "some((" + newTarget + ") => ";
                }
                else {
                    code +=  targetName +"."+ node.lhs.name + "." + "some((" + newTarget + ") => ";
                }
            }
            else {
                newTarget = targetName + "." + node.lhs.name;

                if (node.lhs.isOptional || targetName.endsWith("?")) {
                    newTarget += "?";
                }
            }

            depth++;

            if (node.rhs instanceof Node.StatementNode) {
                code += this.translateStatement(node.rhs, newTarget, depth);
            }
            else if (node.rhs instanceof Node.PatternNode) {
                code += this.translatePattern(node.rhs, newTarget, depth);
            }
            else if (node.rhs instanceof Node.MatchingOperatorNode) {
                code += this.translateMatching(node.rhs, newTarget, depth);
            }
            else if (node.rhs instanceof Node.BindOperatorNode) {
                code += this.translateBinding(node.rhs, newTarget, depth);
            }
            else {
                throw new SyntaxError(`invalid node in binding: ${node.rhs}`);
            }

            if (node.lhs.isArray) {
                code += ")";
                if (node.lhs.isOptional) {
                    code += " ?? false)";
                }
            }
        }
        else {
            throw new SyntaxError(`invalid node in binding: ${node.rhs}`);
        }

        return code;
    }

    private translateMatching(node: Node.MatchingOperatorNode, targetName: string, depth: number, type: Node.MatchingType = Node.MatchingOperatorNode.PARTIAL): string {
        type = (node.matchType | type) as Node.MatchingType;
        return this.getNodeCode(node.node, targetName, depth, type);
    }

    private translateBinaryOperator(node: Node.BinaryOperatorNode, targetName: string, depth: number, type: Node.MatchingType = Node.MatchingOperatorNode.PARTIAL): string {
        switch (node.operator) {
            case "and":
            case "or":
                return this.translateLogicalOperator(node, targetName, depth, type);
            case "==":
            case "!=":
            case "<=":
            case ">=":
            case "<":
            case ">":
                return this.translateCompareOperator(node, targetName, depth, type);
            default:
                throw new SyntaxError(`unknown operator: '${node.operator}'`)
        }
    }

    private translateLogicalOperator(node: Node.BinaryOperatorNode, targetName: string, depth: number, type: Node.MatchingType = Node.MatchingOperatorNode.PARTIAL): string {
        let code = this.getNodeCode(node.lhs, targetName, depth, type);

        switch (node.operator) {
            case "and":
                code += " && ";
                break;
            case "or":
                code += " || ";
                break;
            default:
                break;
        }

        code += this.getNodeCode(node.rhs, targetName, depth, type);

        return code;
    }

    private translateCompareOperator(node: Node.BinaryOperatorNode, targetName: string, depth: number, type: Node.MatchingType = Node.MatchingOperatorNode.PARTIAL): string {
        let code: string;

        if (node.lhs instanceof Node.NumberNode) {
            code = this.translateNumber(node.lhs);
        }
        else if (node.lhs instanceof Node.StringNode) {
            code = "\"" + node.lhs.value + "\"";
        }
        else {
            code = this.getNodeCode(node.lhs, targetName, depth, type);
        }

        switch (node.operator) {
            case "==":
                code += " === ";
                break;
            case "!=":
                code += " !== ";
                break;
            default:
                code += " " + node.operator + " ";
                break;
        }

        if (node.rhs instanceof Node.NumberNode) {
            code += this.translateNumber(node.rhs);
        }
        else if (node.rhs instanceof Node.StringNode) {
            code += "\"" + node.rhs.value + "\"";
        }
        else {
            code += this.getNodeCode(node.rhs, targetName, depth, type);
        }
        
        return code;
    }

    private translateNotCompareOperator(node: Node.BinaryOperatorNode, targetName: string, depth: number, type: Node.MatchingType = Node.MatchingOperatorNode.PARTIAL): string {
        let code: string;

        if (node.lhs instanceof Node.NumberNode) {
            code = this.translateNumber(node.lhs);
        }
        else if (node.lhs instanceof Node.StringNode) {
            code = "\"" + node.lhs.value + "\"";
        }
        else {
            code = this.getNodeCode(node.lhs, targetName, depth, type);
        }

        switch (node.operator) {
            case "==":
                code += " !== ";
                break;
            case "!=":
                code += " === ";
                break;
            case ">=":
                code += " < ";
                break;
            case "<=":
                code += " > ";
                break;
            case ">":
                code += " <= ";
                break;
            case "<":
                code += " >= ";
                break;
            default:
                throw new SyntaxError(`invalid node: ${node}`);
        }

        if (node.rhs instanceof Node.NumberNode) {
            code += this.translateNumber(node.rhs);
        }
        else if (node.rhs instanceof Node.StringNode) {
            code += "\"" + node.rhs.value + "\"";
        }
        else {
            code += this.getNodeCode(node.rhs, targetName, depth, type);
        }
        
        return code;
    }

    private translateUnaryOperator(node: Node.UnaryOperatorNode, targetName: string, depth: number, type: Node.MatchingType = Node.MatchingOperatorNode.PARTIAL): string {
        let code: string;
        let childNode: Node.SearchNode | null = node.node;

        switch (node.operator) {
            case "not":
                while ((childNode instanceof Node.MatchingOperatorNode && childNode.matchType === Node.MatchingOperatorNode.PARTIAL)
                    || childNode instanceof Node.BraceNode) {
                    childNode = childNode.node;
                }
                
                if (childNode instanceof Node.BinaryOperatorNode && OtmSearch.COMPARE_OPERANDS.indexOf(childNode.operator) !== -1) {
                    code = this.translateNotCompareOperator(childNode, targetName, depth, type);
                }
                else {
                    code = "!(" + this.getNodeCode(childNode, targetName, depth, type) + ")";
                }
                break;
            default:
                throw new SyntaxError(`invalid node (in unary): ${node.node}`);
        }

        return code;
    }

    private translateBrace(node: Node.BraceNode, targetName: string, depth: number, type: Node.MatchingType = Node.MatchingOperatorNode.PARTIAL): string {
        if (node.node instanceof Node.MatchingOperatorNode) {
            return "(" + this.translateMatching(node.node, targetName, depth, type) + ")";
        }
        else {
            return "(" + this.getNodeCode(node.node, targetName, depth, type) + ")";
        }
    }

    private getNodeCode(node: Node.SearchNode | null, targetName: string, depth: number, type: Node.MatchingType): string {
        if (node instanceof Node.VariableNode) {
            const variable = this.variables.get(node.name);
            if (variable) {
                return "(" + this.translateMatching(variable, targetName, depth, type) + ")";
            }
            else {
                throw new SyntaxError(`undefined variable: ${node.name}`);
            }
        }
        else if (node instanceof Node.BinaryOperatorNode) {
            return this.translateBinaryOperator(node, targetName, depth, type);
        }
        else if (node instanceof Node.UnaryOperatorNode) {
            return this.translateUnaryOperator(node, targetName, depth, type);
        }
        else if (node instanceof Node.BraceNode) {
            return this.translateBrace(node, targetName, depth, type);
        }
        else if (node instanceof Node.KeywordVariableNode) {
            return this.translateKeywordVariable(node, targetName);
        }
        else if (node instanceof Node.StringNode) {
            return this.translateString(node, targetName, type);
        }
        else {
            throw new SyntaxError(`invalid node: ${node}`);
        }
    }

    private translateKeywordVariable(node: Node.KeywordVariableNode, targetName: string): string {
        let code: string;

        switch (node.value) {
            case "length":
                if (targetName.endsWith("?")) {
                    code = "Array.from("+ targetName.slice(0, -1) +" ?? []).length";
                }
                else {
                    code = "Array.from("+ targetName +").length";
                }
                break;
            case "value":
                if (targetName.endsWith("?")) {
                    code = targetName.slice(0, -1);
                }
                else {
                    code = targetName;
                }
                break;
            default:
                throw new SyntaxError(`invalid Keyword Value: ${node.value}`);
        }

        return code;
    }

    private translateString(node: Node.StringNode, targetName: string, type: Node.MatchingType = Node.MatchingOperatorNode.PARTIAL): string {
        let code: string;

        switch (type) {
            case Node.MatchingOperatorNode.PARTIAL:
                if (targetName.endsWith("?")) {
                    code = "(" + targetName + ".indexOf(\"" + node.value + "\") ?? -1) !== -1";
                }
                else {
                    code = targetName + ".indexOf(\"" + node.value + "\") !== -1";
                }
                break;
            case Node.MatchingOperatorNode.FORWARD:
                code = targetName + ".startsWith(\"" + node.value + "\")";
                break;
            case Node.MatchingOperatorNode.BACKWARD:
                code = targetName + ".endsWith(\"" + node.value + "\")";
                break;
            case Node.MatchingOperatorNode.EXACT:
                code = targetName + " === \"" + node.value + "\"";
                break;
            default:
                code = "(" + targetName + ".indexOf(\"" + node.value + "\") ?? -1) !== -1";
                break;
        }

        return code;
    }

    private translateNumber(node: Node.NumberNode): string {
        return node.value;
    }

    private static readonly KEYWORDS: string[] = [
        "and", "or", "not",
    ]
    
    private static readonly COMPARE_OPERANDS: string[] = [
        "==", "!=", ">=", "<=", ">", "<"
    ];
}
