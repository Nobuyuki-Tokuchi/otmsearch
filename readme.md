# OTM Search
OTM-JSON形式のファイルを比較的簡易的な構文でスクリプト検索のようなことを行うためのライブラリ．

## 使用方法
```
    // 検索スクリプト文字列をコンストラクタに渡す
    const search = new OtmSearch(code.value);
    // コンパイルすると`function (word) { ~ }`の関数が作成される．
    const func = search.compile();
```

## 入力例
```
entry.form = (^ "a" | "e" | "i") | @@length >= 3;
translations.title = "動詞" | ("名詞" & !"代名詞") $;
```

## 構文
```
programme := (statement)*
statement := key_name '=' matching
          := variable '=' matching
matching  := ('^')? or_expr ('$')?
or_expr   := and_expr (('or' | '|') and_expr)*
and_expr  := (compare | not_expr) (('and' | '&') (compare | not_expr))*
compare   := '@@length' ('<' | '<=' | '>' | '>=' | '==' | '!=' ) number
not_expr  := ('!')? term
term      := value | variable | '(' matching ')'
value     := '"' .+ '"'
variable  := '@' name
key_name  := name ('.' name)*
name      := [A-Za-z_][A-Za-z0-9_]+
comment   := '#' .+ ('\r' | '\n')
```

* '^' および '$' については 適用範囲がスコープ内(ほぼ括弧内)全てにかかるため注意．
(比較演算部分を除く)
```
# 以下は`entry.form = (^ "a" | "y" $) & ("ts" | "ks" $)`と同じとなる
entry.form = (^ "a" | "y") & ("ts" | "ks")$
```
