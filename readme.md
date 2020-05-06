# OTM Search
OTM-JSON形式のファイルを比較的簡易的な構文でスクリプト検索のようなことを行うためのライブラリ．

## 使用方法
```
    // 検索スクリプト文字列をコンストラクタに渡す
    const search = new OtmSearch(code.value);
    // コンパイルすると`function (words) { ~ }`の関数が作成される．
    const func = search.compile();
```

## 入力例
```
@verb : "動詞",
words[] : [
    {
        entry : {
            form : ^ "a"
        },
    },
    {
        entry.form : ! (^ "a"),
        translations[] : [
            {
                title : "名詞" | @verb $,
            },
            {
                title : @verb $,
                forms : "[与]"
            },
        ],
    },
    {
        translations[].title : @verb $
    }
]
```

## 構文
```
pragramme   := pattern
pattern     := statement | '[' (statement) (',' (statement))+ ']'
statement   := (define) | '{' (define) (',' (define))+ '}'
define      := key_name ':' (pattern | matching)
            := variable ':' (value | variable)
matching    := ('^')? or_expr ('$')?
or_expr     := and_expr (('or' | '|') and_expr)*
and_expr    := (compare | not_expr) (('and' | '&') (compare | not_expr))*
compare     := ('%length' | number) ('<' | '<=' | '>' | '>=' | '==' | '!=') ('%length' | number)
not_expr    := ('!'|'not')? term
term        := value | variable | '(' matching ')'
value       := string | number
string      := '"' .+ '"'
number      := [0-9]+
variable    := '@' name
key_name    := name ('.' name)* '[]'
name        := [A-Za-z_][A-Za-z0-9_]+
comment     := '#' .+ ('\r' | '\n')
```

* '^' および '$' については 適用範囲がスコープ内(ほぼ括弧内)全てにかかるため注意．
(比較演算部分を除く)
```
# 以下は`entry.form = (^ "a" | "y" $) & ("ts" | "ks" $);`と同じとなる
entry.form = (^ "a" | "y") & ("ts" | "ks")$;
```
