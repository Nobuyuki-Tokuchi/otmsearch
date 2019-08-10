class OtmSearch {
    private code: string;
    private tokens: SearchToken[];
    private nodes: SearchNode[];
    private variables: {[x: string]: SearchNode};
    private translatedCode: string;
    private func?: Function;

    constructor(code: string) {
        this.code = code;
        this.tokens = [];
        this.nodes = [];
        this.variables = {};
        this.translatedCode = "";
    }

    public compile(): Function {
        if(typeof(this.func) === "undefined") {
            this.tokens = this.tokenize();
            this.nodes = this.parse(this.tokens);
            this.func = this.translate(this.nodes);
        }
        return this.func;
    }

    private tokenize(): SearchToken[] {
        const list: SearchToken[] = [];
        let buffer: string = "";

        const append = () => {
            if (buffer.length > 0) {
                if (OtmSearch.KEY_NAMES.indexOf(buffer) !== -1) {
                    list.push(new KeyNameToken(buffer));
                }
                else if (OtmSearch.KEYWORDS.indexOf(buffer) !== -1) {
                    switch(buffer) {
                        case "not":
                            list.push(new UnaryOperatorToken(buffer));
                            break;
                        default:
                            list.push(new BinaryOperatorToken(buffer));
                            break;
                    }
                }
                else if (buffer.indexOf("@") === 0) {
                    list.push(new VariableToken(buffer));
                }
                else if (buffer.match(/^".+"$/)) {
                    list.push(new ValueToken(buffer.substring(1, buffer.length - 1)));
                }
                else if (buffer.match(/^\d+$/)) {
                    list.push(new NumberToken(buffer));
                }
                else {
                    throw new SyntaxError(`invalid token: ${buffer}`);
                }
            }

            buffer = "";
        };

        let isString = false;
        for (let i = 0; i < this.code.length; i++) {
            const c = this.code[i];
            if(isString) {
                if(buffer[buffer.length - 1] !== "\\" && c === "\"") {
                    list.push(new ValueToken(buffer.substring(1)));
                    buffer = "";
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
                    case "\r":
                    case "\n":
                        append();
                        break;
                    case "#":
                        append();
                        while(i < this.code.length && this.code[i] !== "\r" && this.code[i] !== "\n") {
                            i++;
                        }
                        break;
                    case "&":
                    case "|":
                        append();
                        list.push(new BinaryOperatorToken(c));
                        break;
                    case "=":
                        if(this.code[i + 1] === "=") {
                            append();
                            list.push(new BinaryOperatorToken("=="));
                            i++;
                        }
                        else {
                            append();
                            list.push(new BindToken());
                        }
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
                            list.push(new UnaryOperatorToken(c));
                        }
                        break;
                    case "^":
                    case "$":
                        append();
                        list.push(new MatchingOperatorToken(c));
                        break;
                    case "(":
                    case ")":
                    // case "{":
                    // case "}":
                        append();
                        list.push(new BraceToken(c));
                        break;
                    case ";":
                        append();
                        list.push(new SemicolonToken());
                        break;
                    case ":":
                        append();
                        list.push(new ColonToken());
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

    private parse(tokens: SearchToken[]): SearchNode[] {
        let count = 0;
        const list: SearchNode[] = [];

        while(count < tokens.length) {
            const token = tokens[count];
            if(!(token instanceof KeyNameToken) && !(token instanceof VariableToken)) {
                throw new SyntaxError(`invalid token: ${token}`);
            }

            const next = tokens[++count];
            if(next instanceof BindToken) {
                if (token instanceof KeyNameToken) {
                    const node = new BindOperatorNode();
                    node.lhs = new KeyNameNode(token.name);
                    [node.rhs, count] = this.parseMatching(tokens, count + 1);
                    list.push(node);
                }
                else {
                    [this.variables[token.name], count] = this.parseMatching(tokens, count + 1);
                }
            }
            else {
                throw new SyntaxError(`require '=' after '${token.name}'`);
            }

            if (count >= tokens.length) {
                throw new SyntaxError("not found ';'");
            }
            else if (!(tokens[count] instanceof SemicolonToken)) {
                throw new SyntaxError(`not found ';'. got ${tokens[count]}`);
            }
            count++;
        }

        return list;
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

    private parseOr(tokens: SearchToken[], count: number): [SearchNode, number] {
        let node: SearchNode;
        [node, count] = this.parseAnd(tokens, count); 

        while (count < tokens.length) {
            const token = tokens[count];

            if(token instanceof BinaryOperatorToken && (token.operator === "|" || token.operator === "or")) {
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

    private parseAnd(tokens: SearchToken[], count: number): [SearchNode, number] {
        let node: SearchNode;
        if(tokens[count] instanceof UnaryOperatorToken) {
            [node, count] = this.parseNot(tokens, count); 
        }
        else {
            [node, count] = this.parseCompare(tokens, count);
        }

        while (count < tokens.length) {
            const token = tokens[count];

            if(token instanceof BinaryOperatorToken && (token.operator === "&" || token.operator === "and")) {
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

    private parseNot(tokens: SearchToken[], count: number): [SearchNode, number] {
        let token = tokens[count];
        let node: SearchNode;

        if (token instanceof UnaryOperatorToken && (token.operator === "!" || token.operator === "not")) {
            node = new UnaryOperatorNode("not");
            [(node as UnaryOperatorNode).node, count] = this.parseData(tokens, count + 1);

            return [node, count];
        }
        else {
            return this.parseData(tokens, count);
        }
    }

    private parseCompare(tokens: SearchToken[], count: number): [SearchNode, number] {
        let node: SearchNode;
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

    private parseData(tokens: SearchToken[], count: number): [SearchNode, number] {
        const token = tokens[count];
        let node: SearchNode;
        
        if (token instanceof BraceToken) {
            if(token.value === "(") {
                const brace = new BraceNode();
                [brace.node, count] = this.parseMatching(tokens, count + 1);

                const next = tokens[count];
                if(!(next instanceof BraceToken && next.value === ")")) {
                    throw new SyntaxError(`not found ')'. got ${tokens[count]}`);
                }
                node = brace;
            }
            else {
                throw new SyntaxError(`invalid token: ${tokens[count]}`);
            }
        }
        else if (token instanceof VariableToken) {
            node = new VariableNode(token.name);
        } 
        else if (token instanceof NumberToken) {
            node = new NumberNode(token.value);
        }
        else if (token instanceof ValueToken) {
            node = new ValueNode(token.value);
        }
        else {
            throw new SyntaxError(`invalid token: ${token}`);
        }

        return [node, count + 1];
    }

    private translate(nodes: SearchNode[]): Function {
        for (const node of nodes) {
            if (node instanceof BindOperatorNode) {
                if (this.translatedCode.length > 0) { this.translatedCode += "\n    && "; } 
                if(node.lhs instanceof KeyNameNode) {
                    switch(node.lhs.name) {
                        case "entry.form":
                            this.translatedCode += "(" + this.translateMatching(node.rhs as SearchNode, "word.entry.form") + ")";
                            break;
                        case "translations.title":
                            this.translatedCode += "(function () { "
                                + "var result = word.translations.map(function(x) { return x.title; }); "
                                + "return " + this.translateMatching(node.rhs as SearchNode, "result", true) + "; "
                                + "})()";
                            break;
                        case "translations.forms":
                            this.translatedCode += "word.translations.some(function(x) { return x.forms.some(function(y) { return "
                                + this.translateMatching(node.rhs as SearchNode, "y")
                                + "; }); })";
                            break;
                        case "contents.title":
                            this.translatedCode += "(function () { "
                                + "var result = word.contents.map(function(x) { return x.title; }); "
                                + "return " + this.translateMatching(node.rhs as SearchNode, "result", true) + "; "
                                + "})()";
                            break;
                        case "contents.text":
                            this.translatedCode += "(function () { "
                                + "var result = word.contents.map(function(x) { return x.text; }); "
                                + "return " + this.translateMatching(node.rhs as SearchNode, "result", true) + "; "
                                + "})()";
                            break;
                        case "relations.title":
                            this.translatedCode += "(function () { "
                                + "var result = word.relations.map(function(x) { return x.title; }); "
                                + "return " + this.translateMatching(node.rhs as SearchNode, "result", true) + "; "
                                + "})()";
                            break;
                        case "relations.entry.form":
                            this.translatedCode += "(function () { "
                                + "var result = word.relations.map(function(x) { return x.entry.form; }); "
                                + "return " + this.translateMatching(node.rhs as SearchNode, "result", true) + "; "
                                + "})()";
                            break;
                        case "tags":
                            this.translatedCode += "(" + this.translateMatching(node.rhs as SearchNode, "word.tags", true) + ")";
                            break;
                        case "variations.title":
                            this.translatedCode += "(function () { "
                                + "var result = word.variations.map(function(x) { return x.title; }); "
                                + "return " + this.translateMatching(node.rhs as SearchNode, "result", true) + "; "
                                + "})()";
                            break;
                        case "variations.form":
                            this.translatedCode += "(function () { "
                                + "var result = word.variations.map(function(x) { return x.form; }); "
                                + "return " + this.translateMatching(node.rhs as SearchNode, "result", true) + "; "
                                + "})()";
                            break;
                        default:
                            throw new SyntaxError(`invalid node: ${node}`)
                    }
                }
                else {
                    throw new SyntaxError("left operand is null");
                }
            }
        }

        return new Function("word", `return ${this.translatedCode};`);
    }

    private translateMatching(node: SearchNode, name: string, isTag: boolean = false, matchType: number = MatchingOperatorNode.PARTIAL): string {
        let str = "";

        if(node instanceof MatchingOperatorNode) {
            str = this.translateMatching(node.node as SearchNode, name, isTag, node.matchType | matchType);
        }
        else if(node instanceof BraceNode) {
            str = "(" + this.translateMatching(node.node as SearchNode, name, isTag, matchType) + ")";
        }
        else if (node instanceof ValueNode) {
            str = this.translateValue(node, name, isTag, matchType);
        }
        else if (node instanceof VariableNode) {
            str = this.translateMatching(this.variables[node.name], name, isTag, matchType);
        }
        else {
            str = this.translateOperator(node as SearchNode, name, isTag, matchType);
        }

        return str;
    }

    private translateOperator(node: SearchNode, name: string, isTag: boolean,  matchType: number): string {
        let str = "";

        if(node instanceof BinaryOperatorNode) {
            switch(node.operator) {
                case "or":
                    str = this.translateMatching(node.lhs as SearchNode, name, isTag, matchType)
                        + " || " + this.translateMatching(node.rhs as SearchNode, name, isTag, matchType);
                    break;
                case "and":
                    str = this.translateMatching(node.lhs as SearchNode, name, isTag, matchType)
                        + " && " + this.translateMatching(node.rhs as SearchNode, name, isTag, matchType);
                    break;
                case "<":
                case ">":
                case "==":
                case "!=":
                case "<=":
                case ">=":
                    str = this.translateLength(node, name, isTag);
                    break;
            }
        }
        else if (node instanceof UnaryOperatorNode) {
            switch(node.operator) {
                case "not":
                    str = "!(" + this.translateMatching(node.node as SearchNode, name, isTag, matchType) + ")";
                    break;
            }
        }

        return str;
    }

    private translateValue(node: ValueNode, name: string, isTag: boolean, matchType: number): string {
        let str: string;
        let target = isTag ? "x" : name;

        switch(matchType) {
            case MatchingOperatorNode.PARTIAL:
                str = target + `.indexOf("${node.value}") !== -1`;
                break;
            case MatchingOperatorNode.FORWARD:
                str = target + `.substring(0, ${(node.value.length)}) === "${node.value}"`;
                break;
            case MatchingOperatorNode.BACKWARD:
                str = target + `.substring(${target}.length - ${(node.value.length)}) === "${node.value}"`;
                break;
            case MatchingOperatorNode.EXACT:
                str = target + ` === "${node.value}"`;
                break;
            default:
                str = target + `.indexOf("${node.value}") !== -1`;
                break;
        }

        if(isTag) {
            str = name + `.some(function(x) { return ${str}; })`;
        }

        return str;
    }

    private translateLength(node: BinaryOperatorNode, name: string, isTag: boolean): string {
        let str: string;
        let target = isTag ? "x" : name;

        if (!(node.lhs instanceof VariableNode && node.lhs.name === "@@length")) {
            throw new SyntaxError(`compare operation's left operand is wrong: ${node.lhs}`);
        }

        if(!(node.rhs instanceof NumberNode)) {
            throw new SyntaxError(`compare operation's right operand is wrong: ${node.rhs}`);
        }

        str = target + `.length ${node.operator} ${node.rhs.value}`;

        if(isTag) {
            str = name + `.some(function(x) { return ${str}; })`;
        }

        return str;
    }

    private static readonly KEY_NAMES = [
        "entry.form",
        "translations.title",
        "translations.forms",
        "contents.title",
        "contents.text",
        "relations.title",
        "relations.entry.form",
        "tags",
        "variations.title",
        "variations.form",
    ];

    private static readonly KEYWORDS: string[] = [
        "and", "or", "not",
    ]
}
