const path = require("path");

module.exports = {
    mode: "development",
    entry: "./src/otmsearch.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "otmsearch.js",
        library: "OtmSearch",
        libraryExport: "default",
        libraryTarget: "umd",
        globalObject: "this",
    },
    module: {
        rules: [
            {
                test: /\.ts/,
                include: [path.resolve(__dirname, "src")],
                loader: "ts-loader",
            }
        ]
    },
    resolve: {
        extensions: [".ts", ".js"]
    }
}