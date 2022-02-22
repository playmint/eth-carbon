"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function main() {
    const transactions = await (0, index_1.getTransactions)();
    let totalGas = 0;
    for (let i = 0; i < transactions.length; ++i) {
        if (!transactions[i].isError) {
            totalGas += transactions[i].gasUsed;
        }
    }
    console.log(totalGas);
}
main().catch((e) => {
    console.error(e);
});
//# sourceMappingURL=test.js.map