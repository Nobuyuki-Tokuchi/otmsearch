# OTM Search
OTM-JSON形式の辞書を比較的簡易的な構文でスクリプト検索のようなことを行うためのライブラリ．

## 使用方法
```
// 検索スクリプト文字列をコンストラクタに渡す
const search = new OtmSearch(code.value);
// コンパイルすると`function (words) { ~ }`の関数が作成される．
const func = search.compile();
```

## 入力例
```
[
    @verb : "動詞",
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
key_name    := name optional? array? ('.' name optional? array?)*
array       := '[]'
optional    := '?'
name        := [A-Za-z_][A-Za-z0-9_]+
comment     := '#' .+ ('\r' | '\n')
```

### キー名に付く記号について
OTM Searchには '[]' および '?' の記号が存在し，それぞれ「配列記号」「オプショナル記号」と呼ぶ．
* '[]' はその要素が配列となっていることを示す．この場合，検索条件は「配列内に指定した条件を満たすものが1つ以上存在するか」となる．
* '?' はその要素が存在しない可能性があることを示す．

### マッチング演算子の注意点
'^' および '$' については適用範囲がスコープ内(ほぼ括弧内)全てにかかるため注意．(比較演算部分を除く)
```
# 以下は`entry.form: (^ "a" | "y" $) & ("ts" | "ks" $)`と同じとなる
entry.form: (^ "a" | "y") & ("ts" | "ks")$
```

### オプショナル記号の注意点
'?' は配列記号の付く要素の子要素である場合を除いて継承される．
```
# 以下は`entry?.form?: "a" | "b"`と同じになる
entry?.form: "a" | "b"
```
```
# 以下の場合はtranslationsが配列記号付きであることから，titleは配列記号付き要素の子要素となるため，
# `translations?[].title?: "名詞" | "動詞"`とはならない．
translations?[].title: "名詞" | "動詞"
```

### その他
配列のfilterメソッドに対してコンパイルした結果の関数を渡す形となるのであれば，OTM-JSON形式の辞書以外でも動作すると思いますが，保証はしません．
