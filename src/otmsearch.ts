class OtmSearch {
    private code: string;
    private tokens: SearchToken[];
    private node: SearchNode | null;
    private variables: Map<string, MatchingOperatorNode>;
    private translatedCode: string;
    private func?: Function;

    constructor(code: string) {
        this.code = code;
        this.tokens = [];
        this.node = null;
        this.variables = new Map<string, MatchingOperatorNode>();
        this.translatedCode = "";
    }

    public compile(): Function {
        if(typeof(this.func) === "undefined") {
            this.tokens = this.tokenize();
            this.node = this.parse(this.tokens);
            this.func = this.translate(this.node ?? new PatternNode());
        }
        return this.func;
    }

    private tokenize(): SearchToken[] {
        const list: SearchToken[] = [];
        let buffer: string = "";

        const append = () => {
            if (buffer.length > 0) {
                if (OtmSearch.KEYWORDS.indexOf(buffer) !== -1) {
                    switch(buffer) {
                        case "not":
                            list.push(new UnaryOperatorToken(buffer));
                            break;
                        default:
                            list.push(new BinaryOperatorToken(buffer));
                            break;
                    }
                }
                else if (buffer[0] === "@") {
                    if (buffer.length > 2 && buffer[1] === "@") {
                        list.push(new KeywordVariableToken(buffer));
                    }
                    else if (buffer.length > 1) {
                        list.push(new VariableToken(buffer));
                    }
                    else {
                        throw new SyntaxError(`invalid token: ${buffer}`);
                    }
                }
                else if (buffer.match(/^".+"$/)) {
                    list.push(new StringToken(buffer.substring(1, buffer.length - 1)));
                }
                else if (buffer.match(/^\d+$/)) {
                    list.push(new NumberToken(buffer));
                }
                else {
                    list.push(new KeyNameToken(buffer));
                }
            }

            buffer = "";
        };

        let isString = false;
        let escapeTable = new Map<string, string>();
        escapeTable.set("\'", "\'");
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
                    throw new SyntaxError(`invalid token in string: ${c}`);
                }

                if (c === '\\') {
                    i++;
                    const next = this.code[i];
                    if (escapeTable.has(next)) {
                        buffer += escapeTable.get(next);
                    }
                    else if (next === "x") {
                        i++;
                        const hex = this.code.substring(i, i + 2);
                        if (hex.match(/[0-9A-Fa-f]+/)) {
                            buffer += String.fromCharCode(parseInt(hex, 16));
                            i += 2;
                        }
                        else {
                            throw new SyntaxError(`invalid token in string: \\x${hex}`);
                        }
                    }
                    else if (next === "u") {
                        i++;
                        if (this.code[i] === "{") {
                            const index = this.code.indexOf("}", i);
                            const hex = this.code.substring(i, index);
                            if (hex.match(/[0-9A-Fa-f]+/)) {
                                buffer += String.fromCharCode(parseInt(hex, 16));
                                i = index + 1;
                            }
                            else {
                                throw new SyntaxError(`invalid token in string: \\x${hex}`);
                            }
                        }
                        else {
                            const hex = this.code.substring(i, i + 4);
                            if (hex.match(/[0-9A-Fa-f]+/)) {
                                buffer += String.fromCharCode(parseInt(hex, 16));
                                i += 4;
                            }
                            else {
                                throw new SyntaxError(`invalid token in string: \\x${hex}`);
                            }
                        }
                    }
                }
                else if(c === "\"") {
                    buffer += c;
                    append();
                    isString = false;
                }
                else {
                    buffer += c;
                }
            }
            else {
                switch (c) {
                    case " ":
                    case "\t":
                    case "\n":
                        append();
                        break;
                    case "\r":
                        append();
                        if (this.code[i + 1] === "\n") {
                            i++;
                        }
                        break;
                    case "#":
                        append();
                        while(i < this.code.length && this.code[i] !== "\r" && this.code[i] !== "\n") {
                            i++;
                        }
                        break;
                    case "&":
                        append();
                        list.push(new BinaryOperatorToken("and"));
                        break;
                    case "|":
                        append();
                        list.push(new BinaryOperatorToken("or"));
                        break;
                    case "=":
                        if(this.code[i + 1] === "=") {
                            append();
                            list.push(new BinaryOperatorToken("=="));
                            i++;
                        }
                        else {
                            throw new SyntaxError(`invalid token (tokenizer): ${c}`);
                        }
                        break;
                    case ":":
                        append();
                        list.push(new BindToken());
                        break;
                    case "<":
                    case ">":
                        if(this.code[i + 1] === "=") {
                            append();
                            list.push(new BinaryOperatorToken(c + "="));
                            i++;
                        }
                        else {
                            append();
                            list.push(new BinaryOperatorToken(c));
                        }
                        break;
                    case "!":
                        if(this.code[i + 1] === "=") {
                            append();
                            list.push(new BinaryOperatorToken("!="));
                            i++;
                        }
                        else {
                            append();
                            list.push(new UnaryOperatorToken("not"));
                        }
                        break;
                    case "^":
                    case "$":
                        append();
                        list.push(new MatchingOperatorToken(c));
                        break;
                    case "(":
                    case ")":
                        append();
                        list.push(new BraceToken(c));
                        break;
                    case "{":
                    case "}":
                        append();
                        list.push(new StatementBraceToken(c));
                        break;
                    case "[":
                        append();
                        const last = list[list.length - 1];
                        if (last instanceof KeyNameToken) {
                            i++;
                            const next = this.code[i];
                            if (next !== "]") {
                                throw new SyntaxError(`invalid token (tokenizer): ${last.name + c + next}`);
                            }

                            list.pop();
                            buffer = last.name + "[]";
                        }
                        else {
                            list.push(new PatternBraceToken(c));
                        }
                        break;
                    case "]":
                        append();
                        list.push(new PatternBraceToken(c));
                        break;
                    case ",":
                        append();
                        list.push(new CommaToken());
                        break;
                    case "\"":
                        append();
                        buffer += c;
                        isString = true;
                        break;
                    default:
                        buffer += c;
                        break;
                }
            }
        }
        append();

        return list;
    }

    private parse(tokens: SearchToken[]): SearchNode {
        let count = 0;
        return this.parsePattern(tokens, count)[0];
    }

    private parsePattern(tokens: SearchToken[], count: number): [BindOperatorNode | StatementNode | PatternNode, number] {
        let token = tokens[count];
        let hasBrace = token instanceof PatternBraceToken && token.tokenValue === "[";
        let pattern: BindOperatorNode | StatementNode | PatternNode;

        if (hasBrace) {
            count++;
            token = tokens[count];

            pattern = new PatternNode();
            let node: BindOperatorNode | StatementNode;

            while (count < tokens.length && !(token instanceof PatternBraceToken && token.tokenValue === "]")) {
                if (pattern.nodes.length > 0) {
                    if (!(token instanceof CommaToken)) {
                        throw new SyntaxError(`required to ',' in pattern): ${token}`);
                    }
                    count++;
                }

                [node, count] = this.parseStatement(tokens, count);
                pattern.nodes.push(node);

                token = tokens[count];
            }

            if (!(token instanceof PatternBraceToken && token.tokenValue === "]")) {
                throw new SyntaxError(`invalid token (end pattern): ${token}`);
            }
            count++;
        }
        else {
            [pattern, count] = this.parseStatement(tokens, count);
        }

        return [pattern, count];
    }

    private parseStatement(tokens: SearchToken[], count: number): [BindOperatorNode | StatementNode, number] {
        let token = tokens[count];
        let hasBrace = token instanceof StatementBraceToken && token.tokenValue === "{";
        let statement: BindOperatorNode | StatementNode;

        if (hasBrace) {
            count++;
            token = tokens[count];
            statement = new StatementNode();
            let node;

            while (count < tokens.length && !(token instanceof StatementBraceToken && token.tokenValue === "}")) {
                if (statement.nodes.length > 0) {
                    if (!(token instanceof CommaToken)) {
                        throw new SyntaxError(`required to ',' in statement): ${token}`);
                    }
                    count++;
                }
                [node, count] = this.parseDefine(tokens, count);
                statement.nodes.push(node);

                token = tokens[count];
            }

            token = tokens[count];
            if (!(token instanceof StatementBraceToken && token.tokenValue === "}")) {
                throw new SyntaxError(`invalid token (end statement): ${token}`);
            }
            count++;
        }
        else {
            [statement, count] = this.parseDefine(tokens, count);
        }

        return [statement, count];
    }

    private parseDefine(tokens: SearchToken[], count: number): [BindOperatorNode, number] {
        const keyName = tokens[count];
        
        if(!(keyName instanceof KeyNameToken) && !(keyName instanceof VariableToken)) {
            throw new SyntaxError(`invalid token in define: ${keyName}`);
        }
        count++;

        let token = tokens[count];
        if (!(token instanceof BindToken)) {
            throw new SyntaxError(`require ':' after '${keyName}'`);
        }
        count++;

        let node = new BindOperatorNode();

        if (keyName instanceof KeyNameToken) {
            let point;
            let names = keyName.name.split(".");
    
            node.lhs = new KeyNameNode(names[0]);
            if (names.length > 1) {
                point = node;
                for (let i = 1; i < names.length; i++) {
                    let branch = new BindOperatorNode();
                    branch.lhs = new KeyNameNode(names[i]);
    
                    point.rhs = branch;
                    point = branch;
                }
            }
            else {
                point = node;
            }

            token = tokens[count];
            if (token instanceof StatementBraceToken) {
                [point.rhs, count] = this.parseStatement(tokens, count);
            }
            else if (token instanceof PatternBraceToken) {
                [point.rhs, count] = this.parsePattern(tokens, count);
            }
            else {
                [point.rhs, count] = this.parseMatching(tokens, count);
            }
        }
        else {
            node.lhs = new VariableNode(keyName.name);
            [node.rhs, count] = this.parseMatching(tokens, count);
        }

        return [node, count];
    }

    private parseMatching(tokens: SearchToken[], count: number): [MatchingOperatorNode, number] {
        let token = tokens[count];
        const fix = new MatchingOperatorNode();

        if(token instanceof MatchingOperatorToken) {
            if(token.operator === MatchingOperatorToken.FORWARD_MATCHIND) {
                fix.matchType = MatchingOperatorNode.FORWARD;
                count++;
            }
            else {
                throw new SyntaxError(`invalid matching token: ${token}`);
            }
        }
        else {
            fix.matchType = MatchingOperatorNode.PARTIAL;
        }

        [fix.node, count] = this.parseOr(tokens, count);

        token = tokens[count];
        if(token instanceof MatchingOperatorToken) {
            if(token.operator === MatchingOperatorToken.BACKWARD_MATCHIND) {
                if(fix.matchType === MatchingOperatorNode.PARTIAL) {
                    fix.matchType = MatchingOperatorNode.BACKWARD;
                }
                else {
                    fix.matchType = MatchingOperatorNode.EXACT;
                }
                count++;
            }
            else {
                throw new SyntaxError(`invalid matching token: ${token}`);
            }
        }

        return [fix,count];
    }

    private parseOr(tokens: SearchToken[], count: number): [ValueNode | OperatorNode, number] {
        let node: ValueNode | OperatorNode;
        [node, count] = this.parseAnd(tokens, count); 

        while (count < tokens.length) {
            const token = tokens[count];

            if(token instanceof BinaryOperatorToken && token.operator === "or") {
                const operator = new BinaryOperatorNode("or");
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

    private parseAnd(tokens: SearchToken[], count: number): [ValueNode | OperatorNode, number] {
        let node: ValueNode | OperatorNode;
        if(tokens[count] instanceof UnaryOperatorToken) {
            [node, count] = this.parseNot(tokens, count); 
        }
        else {
            [node, count] = this.parseCompare(tokens, count);
        }

        while (count < tokens.length) {
            const token = tokens[count];

            if(token instanceof BinaryOperatorToken && token.operator === "and") {
                const operator = new BinaryOperatorNode("and");
                operator.lhs = node;

                count++;
                if(tokens[count] instanceof UnaryOperatorToken) {
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

    private parseNot(tokens: SearchToken[], count: number): [ValueNode | OperatorNode, number] {
        let token = tokens[count];
        let node: ValueNode | OperatorNode;

        if (token instanceof UnaryOperatorToken && token.operator === "not") {
            node = new UnaryOperatorNode("not");
            [(node as UnaryOperatorNode).node, count] = this.parseData(tokens, count + 1);

            return [node, count];
        }
        else {
            return this.parseData(tokens, count);
        }
    }

    private parseCompare(tokens: SearchToken[], count: number): [ValueNode | OperatorNode, number] {
        let node: ValueNode | OperatorNode;
        [node, count] = this.parseData(tokens, count); 
        const token = tokens[count];

        if(token instanceof BinaryOperatorToken) {
            switch(token.operator) {
                case "<":
                case ">":
                case "==":
                case "!=":
                case "<=":
                case ">=":
                    const operator = new BinaryOperatorNode(token.operator);
                    operator.lhs = node;
                    [operator.rhs, count] = this.parseData(tokens, count + 1);
    
                    node = operator;
                    break;
            }
        }

        return [node, count];
    }

    private parseData(tokens: SearchToken[], count: number): [ValueNode | OperatorNode, number] {
        const token = tokens[count];
        let node: ValueNode | OperatorNode;
        
        if (token instanceof BraceToken) {
            if(token.tokenValue === "(") {
                const brace = new BraceNode();
                [brace.node, count] = this.parseMatching(tokens, count + 1);

                const next = tokens[count];
                if(!(next instanceof BraceToken && next.tokenValue === ")")) {
                    throw new SyntaxError(`not found ')'. got ${tokens[count]}`);
                }
                node = brace;
            }
            else {
                throw new SyntaxError(`invalid token in data: ${tokens[count]}`);
            }
        }
        else if (token instanceof KeywordVariableToken) {
            node = new KeywordVariableNode(token.name);
        }
        else if (token instanceof VariableToken) {
            node = new VariableNode(token.name);
        } 
        else if (token instanceof NumberToken) {
            node = new NumberNode(token.value);
        }
        else if (token instanceof StringToken) {
            node = new StringNode(token.value);
        }
        else {
            throw new SyntaxError(`invalid token in data: ${token}`);
        }

        return [node, count + 1];
    }

    private translate(node: SearchNode): Function {
        let count = 0;

        if (node instanceof StatementNode) {
            this.translatedCode = this.translateStatement(node, "x" + count, count);
        }
        else if (node instanceof PatternNode) {
            this.translatedCode = this.translatePattern(node, "x" + count, count);
        }
        else if (node instanceof BindOperatorNode) {
            count++;
            this.translatedCode = this.translateBinding(node, "x" + count, count);
        }
        else {
            throw new SyntaxError(`invalid root node ${node}`);
        }

        return new Function("x" + count, `return ${this.translatedCode};`);
    }

    private translateStatement(node: StatementNode, targetName: string, depth: number): string {
        let code = "";
        for (const state of node.nodes) {
            if (code.length) { code += " && "; }

            if (state.lhs instanceof VariableNode) {
                if (state.lhs === null) {
                    throw new SyntaxError(`invalid node in binding variable: ${state.rhs}`);
                }
                this.variables.set(state.lhs.name, state.rhs as MatchingOperatorNode);
            }
            else {
                code += "(" + this.translateBinding(state, targetName, depth) + ")";
            }
        }

        return code;
    }

    private translatePattern(node: PatternNode, targetName: string, depth: number): string {
        let code = "";
        for (const pattern of node.nodes) {
            if (code.length) { code += " || "; }

            if (pattern instanceof BindOperatorNode) {
                if (pattern.lhs instanceof VariableNode) {
                    if (pattern.lhs === null) {
                        throw new SyntaxError(`invalid node in binding variable: ${pattern.rhs}`);
                    }
                    this.variables.set(pattern.lhs.name, pattern.rhs as MatchingOperatorNode);
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

    private translateBinding(node: BindOperatorNode, targetName: string, depth: number): string {
        let code = "";

         if (node.lhs instanceof KeyNameNode) {
            let newTarget: string;

            if (node.lhs.isArray) {
                newTarget = "x" + (depth + 1);
                code += targetName +"."+ node.lhs.name + ".some((" + newTarget + ") => ";
            }
            else {
                newTarget = targetName +"."+ node.lhs.name;
            }

            depth++;

            if (node.rhs instanceof StatementNode) {
                code += this.translateStatement(node.rhs, newTarget, depth);
            }
            else if (node.rhs instanceof PatternNode) {
                code += this.translatePattern(node.rhs, newTarget, depth);
            }
            else if (node.rhs instanceof MatchingOperatorNode) {
                code += this.translateMatching(node.rhs, newTarget, depth);
            }
            else if (node.rhs instanceof BindOperatorNode) {
                code += this.translateBinding(node.rhs, newTarget, depth);
            }
            else {
                throw new SyntaxError(`invalid node in binding: ${node.rhs}`);
            }

            if (node.lhs.isArray) {
                code += ")";
            }
            else {
            }
        }
        else {
            throw new SyntaxError(`invalid node in binding: ${node.rhs}`);
        }

        return code;
    }

    private translateMatching(node: MatchingOperatorNode, targetName: string, depth: number, type: MatchingType = MatchingOperatorNode.PARTIAL): string {
        type = (node.matchType | type) as MatchingType;
        return this.getNodeCode(node.node, targetName, depth, type);
    }

    private translateBinaryOperator(node: BinaryOperatorNode, targetName: string, depth: number, type: MatchingType = MatchingOperatorNode.PARTIAL): string {
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

    private translateLogicalOperator(node: BinaryOperatorNode, targetName: string, depth: number, type: MatchingType = MatchingOperatorNode.PARTIAL): string {
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

    private translateCompareOperator(node: BinaryOperatorNode, targetName: string, depth: number, type: MatchingType = MatchingOperatorNode.PARTIAL): string {
        let code: string;

        if (node.lhs instanceof NumberNode) {
            code = this.translateNumber(node.lhs);
        }
        else {
            code = this.getNodeCode(node.lhs, targetName, depth, type);
        }

        code += " " + node.operator + " ";

        if (node.rhs instanceof NumberNode) {
            code += this.translateNumber(node.rhs);
        }
        else {
            code += this.getNodeCode(node.rhs, targetName, depth, type);
        }
        
        return code;
    }

    private translateUnaryOperator(node: UnaryOperatorNode, targetName: string, depth: number, type: MatchingType = MatchingOperatorNode.PARTIAL): string {
        let code: string;

        switch (node.operator) {
            case "not":
                code = "!(" + this.getNodeCode(node.node, targetName, depth, type) + ")";
                break;
            default:
                throw new SyntaxError(`invalid node (in unary): ${node.node}`);
        }

        return code;
    }

    private translateBrace(node: BraceNode, targetName: string, depth: number, type: MatchingType = MatchingOperatorNode.PARTIAL): string {
        if (node.node instanceof MatchingOperatorNode) {
            return "(" + this.translateMatching(node.node, targetName, depth, type) + ")";
        }
        else {
            return "(" + this.getNodeCode(node.node, targetName, depth, type) + ")";
        }
    }

    private getNodeCode(node: SearchNode | null, targetName: string, depth: number, type: MatchingType): string {
        if (node instanceof VariableNode) {
            if (this.variables.has(node.name)) {
                return this.translateMatching(this.variables.get(node.name)!, targetName, depth, type);
            }
            else {
                throw new SyntaxError(`undefined variable: ${node.name}`);
            }
        }
        else if (node instanceof BinaryOperatorNode) {
            return this.translateBinaryOperator(node, targetName, depth, type);
            
        }
        else if (node instanceof UnaryOperatorNode) {
            return this.translateUnaryOperator(node, targetName, depth, type);
        }
        else if (node instanceof BraceNode) {
            return this.translateBrace(node, targetName, depth, type);
        }
        else if (node instanceof KeywordVariableNode) {
            return this.translateKeywordVariable(node, targetName, depth, type);
        }
        else if (node instanceof StringNode) {
            return this.translateString(node, targetName, depth, type);
        }
        else {
            throw new SyntaxError(`invalid node: ${node}`);
        }
    }

    private translateKeywordVariable(node: KeywordVariableNode, targetName: string, _depth: number, _type: MatchingType): string {
        let code: string;

        switch (node.value) {
            case "@@length":
                code = "Array.from("+ targetName +").length";
                break;
            case "@@value":
                code = targetName;
                break;
            default:
                throw new SyntaxError(`invalid Keyword Value: ${node.value}`);
        }

        return code;
    }

    private translateString(node: StringNode, targetName: string, _depth: number, type: MatchingType = MatchingOperatorNode.PARTIAL): string {
        let code: string;

        switch (type) {
            case MatchingOperatorNode.PARTIAL:
                code = targetName + ".indexOf(\"" + node.value + "\") !== -1";
                break;
            case MatchingOperatorNode.FORWARD:
                code = targetName + ".startsWith(\"" + node.value + "\")";
                break;
            case MatchingOperatorNode.BACKWARD:
                code = targetName + ".endsWith(\"" + node.value + "\")";
                break;
            case MatchingOperatorNode.EXACT:
                code = targetName + " === \"" + node.value + "\"";
                break;
            default:
                code = targetName + ".indexOf(\"" + node.value + "\") !== -1";
                break;
        }

        return code;
    }

    private translateNumber(node: NumberNode): string {
        return node.value;
    }

    private static readonly KEYWORDS: string[] = [
        "and", "or", "not",
    ]
}
