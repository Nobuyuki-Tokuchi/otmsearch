import * as Node from "./otmsearch.node";
import OtmSearchParser from "./otmsearch.parser";
import OtmSearchTokenizer from "./otmsearch.tokenizer";

export default class OtmSearch {
    private code: string;
    private tokenizer: OtmSearchTokenizer;
    private parser: OtmSearchParser;
    private variables: Map<string, Node.MatchingOperatorNode>;
    private translatedCode: string;
    private func?: Function;

    constructor(code: string) {
        this.code = code;
        this.tokenizer = new OtmSearchTokenizer();
        this.parser = new OtmSearchParser();
        this.variables = new Map<string, Node.MatchingOperatorNode>();
        this.translatedCode = "";
    }

    public compile(): Function {
        if(typeof(this.func) === "undefined") {
            const tokens = this.tokenizer.tokenize(this.code);
            const node = this.parser.parse(tokens);
            this.func = this.translate(node ?? new Node.PatternNode());
        }
        return this.func;
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

    private static readonly COMPARE_OPERANDS: string[] = [
        "==", "!=", ">=", "<=", ">", "<"
    ];
}
