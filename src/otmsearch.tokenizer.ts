import OtmSearch from "./otmsearch";
import * as Token from "./otmsearch.token";

export default class OtmSearchTokenizer {
    private _tokens: Token.SearchToken[];
    private _row: number;
    private _column: number;
    private _buffer: string;

    constructor() {
        this._tokens = [];
        this._row = 1;
        this._column = 1;
        this._buffer = "";
    }

    public tokenize(code: string): Token.SearchToken[] {
        return this.tokenizeCode(code);
    }

    private tokenizeCode(code: string): Token.SearchToken[] {
        let isString = false;

        for (let i = 0; i < code.length; i++) {
            const c = code[i];
            if(isString) {
                if (c === "\r" || c === "\n") {
                    throw new SyntaxError(`invalid token in string: ${c}, row:${this._row}, column:${this._column}`);
                }

                if (c === '\\') {
                    i++;
                    this._column++;
                    
                    const next = code[i];
                    if (OtmSearchTokenizer.ESCAPE_TABLE.has(next)) {
                        this._buffer += OtmSearchTokenizer.ESCAPE_TABLE.get(next);
                        this._column++;
                    }
                    else if (next === "x") {
                        i++;
                        this._column++;

                        const hex = code.substring(i, i + 2);
                        if (hex.match(/[0-9A-Fa-f]+/)) {
                            this._buffer += String.fromCharCode(parseInt(hex, 16));
                            i += 2;
                            this._column += 2;
                        }
                        else {
                            throw new SyntaxError(`invalid token in string: \\x${hex}, row:${this._row}, column:${this._column}`);
                        }
                    }
                    else if (next === "u") {
                        i++;
                        this._column++;

                        if (code[i] === "{") {
                            i++;
                            this._column++;

                            const index = code.indexOf("}", i);
                            const hex = code.substring(i, index);
                            if (hex.match(/[0-9A-Fa-f]+/)) {
                                this._buffer += String.fromCharCode(parseInt(hex, 16));
                                i = index + 1;
                                this._column += index + 1;
                            }
                            else {
                                throw new SyntaxError(`invalid token in string: \\u{${hex}}, row:${this._row}, column:${this._column}`);
                            }
                        }
                        else {
                            const hex = code.substring(i, i + 4);
                            if (hex.match(/[0-9A-Fa-f]+/)) {
                                this._buffer += String.fromCharCode(parseInt(hex, 16));
                                i += 4;
                                this._column += 4;
                            }
                            else {
                                throw new SyntaxError(`invalid token in string: \\u${hex}, row:${this._row}, column:${this._column}`);
                            }
                        }
                    }
                }
                else if(c === "\"") {
                    this._buffer += c;
                    this.append();
                    isString = false;
                    this._column++;
                }
                else {
                    this._buffer += c;
                    this._column++;
                }
            }
            else {
                let last: Token.SearchToken;

                switch (c) {
                    case " ":
                    case "\t":
                        this.append();
                        this._column++;
                        break;
                    case "\n":
                        this.append();
                        this._row++;
                        this._column = 0;
                        break;
                    case "\r":
                        this.append();
                        if (code[i + 1] === "\n") {
                            i++;
                        }
                        this._row++;
                        this._column = 0;
                        break;
                    case "#":
                        this.append();
                        while(i < code.length && code[i] !== "\r" && code[i] !== "\n") {
                            i++;
                        }
                        if (code[i] === "\r" || code[i] === "\n") {
                            i--;
                        }
                        break;
                    case "&":
                        this.append();
                        this._tokens.push(new Token.BinaryOperatorToken("and", this._row, this._column));
                        this._column++;
                        break;
                    case "|":
                        this.append();
                        this._tokens.push(new Token.BinaryOperatorToken("or", this._row, this._column));
                        this._column++;
                        break;
                    case "=":
                        if(code[i + 1] === "=") {
                            this.append();
                            this._tokens.push(new Token.BinaryOperatorToken("==", this._row, this._column));
                            i++;
                            this._column += 2;
                        }
                        else {
                            throw new SyntaxError(`invalid token (tokenizer): ${c}, row:${this._row}, column:${this._column}`);
                        }
                        break;
                    case ":":
                        this.append();
                        this._tokens.push(new Token.BindToken(this._row, this._column));
                        this._column++;
                        break;
                    case "<":
                    case ">":
                        if(code[i + 1] === "=") {
                            this.append();
                            this._tokens.push(new Token.BinaryOperatorToken(c + "=", this._row, this._column));
                            i++;
                            this._column += 2;
                        }
                        else {
                            this.append();
                            this._tokens.push(new Token.BinaryOperatorToken(c, this._row, this._column));
                            this._column++;
                        }
                        break;
                    case "!":
                        if(code[i + 1] === "=") {
                            this.append();
                            this._tokens.push(new Token.BinaryOperatorToken("!=", this._row, this._column));
                            i++;
                            this._column += 2;
                        }
                        else {
                            this.append();
                            this._tokens.push(new Token.UnaryOperatorToken("not", this._row, this._column));
                            this._column++;
                        }
                        break;
                    case "^":
                    case "$":
                        this.append();
                        this._tokens.push(new Token.MatchingOperatorToken(c, this._row, this._column));
                        this._column++;
                        break;
                    case "(":
                    case ")":
                        this.append();
                        this._tokens.push(new Token.BraceToken(c, this._row, this._column));
                        this._column++;
                        break;
                    case "{":
                    case "}":
                        this.append();
                        this._tokens.push(new Token.StatementBraceToken(c, this._row, this._column));
                        this._column++;
                        break;
                    case "[":
                        this.append();
                        last = this._tokens[this._tokens.length - 1];
                        if (last instanceof Token.KeyNameToken) {
                            i++;
                            const next = code[i];
                            if (next !== "]") {
                                throw new SyntaxError(`invalid token (tokenizer): ${last.name + c + next}, row:${this._row}, column:${this._column}`);
                            }

                            this._tokens.pop();
                            this._buffer = last.name + "[]";
                            this._column += 2;
                        }
                        else {
                            this._tokens.push(new Token.PatternBraceToken(c, this._row, this._column));
                            this._column++;
                        }
                        break;
                    case "]":
                        this.append();
                        this._tokens.push(new Token.PatternBraceToken(c, this._row, this._column));
                        this._column++;
                        break;
                    case ",":
                        this.append();
                        this._tokens.push(new Token.CommaToken(this._row, this._column));
                        this._column++;
                        break;
                    case "\"":
                        this.append();
                        this._buffer += c;
                        isString = true;
                        this._column++;
                        break;
                    default:
                        this._buffer += c;
                        this._column++;
                        break;
                }
            }
        }
        this.append();

        return this._tokens;
    }

    private append(): void {
        if (this._buffer.length > 0) {
            if (OtmSearchTokenizer.KEYWORDS.indexOf(this._buffer) !== -1) {
                switch(this._buffer) {
                    case "not":
                        this._tokens.push(new Token.UnaryOperatorToken(this._buffer, this._row, this._column - this._buffer.length));
                        break;
                    default:
                        this._tokens.push(new Token.BinaryOperatorToken(this._buffer, this._row, this._column - this._buffer.length));
                        break;
                }
            }
            else if (this._buffer[0] == "%") {
                if (this._buffer.match(/^%[A-Za-z_][A-Za-z0-9_]*$/)) {
                    this._tokens.push(new Token.KeywordVariableToken(this._buffer.substring(1), this._row, this._column - this._buffer.length));
                }
                else {
                    throw new SyntaxError(`invalid token: ${this._buffer}, row:${this._row}, column:${this._column}`);
                }
            }
            else if (this._buffer[0] === "@") {
                if (this._buffer.match(/^@[A-Za-z_][A-Za-z0-9_]*$/)) {
                    this._tokens.push(new Token.VariableToken(this._buffer.substring(1), this._row, this._column - this._buffer.length));
                }
                else {
                    throw new SyntaxError(`invalid token: ${this._buffer}, row:${this._row}, column:${this._column}`);
                }
            }
            else if (this._buffer.match(/^".+"$/)) {
                this._tokens.push(new Token.StringToken(this._buffer.substring(1, this._buffer.length - 1), this._row, this._column - this._buffer.length));
            }
            else if (this._buffer.match(/^\d+$/)) {
                this._tokens.push(new Token.NumberToken(this._buffer, this._row, this._column - this._buffer.length));
            }
            else {
                this._tokens.push(new Token.KeyNameToken(this._buffer, this._row, this._column - this._buffer.length));
            }
        }
    }

    private static readonly KEYWORDS: string[] = [
        "and", "or", "not",
    ];

    private static readonly  ESCAPE_TABLE = new Map<string, string>([
        [ "'", "'" ],
        [ "\\", "\\" ],
        [ "r", "\r" ],
        [ "n", "\n" ],
        [ "v", "\v" ],
        [ "t", "\t" ],
        [ "b", "\b" ],
        [ "f", "\f" ],
        [ "\"", "\"" ],
    ]);
}