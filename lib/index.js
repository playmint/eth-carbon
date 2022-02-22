"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionsForContracts = exports.getTransactionsForAddress = void 0;
const https = __importStar(require("https"));
async function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = "";
            response.on("data", (chunk) => {
                data += chunk;
            });
            response.on("end", () => {
                resolve(data);
            });
        }).on("error", (e) => {
            reject(e);
        });
    });
}
async function getTransactionsForAddress(apiKey, address) {
    // TODO paging
    const responseStr = await get(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=asc&apikey=${apiKey}`);
    const response = JSON.parse(responseStr);
    const transactions = response.result.map((transaction) => {
        return {
            input: transaction.input,
            gasUsed: parseInt(transaction.gasUsed),
            isError: transaction.isError == "1",
            selector: transaction.input.substring(2, 10).toLowerCase()
        };
    });
    return transactions;
}
exports.getTransactionsForAddress = getTransactionsForAddress;
async function getTransactionsForContracts(apiKey, contracts) {
    let result = {};
    for (let i = 0; i < contracts.length; ++i) {
        const contract = contracts[i];
        // TODO if it's only wanting contract creation could optimise the etherscan call
        let filteredTransactions = [];
        let transactions = await getTransactionsForAddress(apiKey, contract.address);
        if (contract.shouldIncludeContractCreation) {
            filteredTransactions.push(transactions[0]);
        }
        for (let j = 1; j < transactions.length; ++j) {
            if (!contract.shouldIncludeFailedTransactions && transactions[j].isError) {
                console.log(contract.address, "pruning", j, "(failed)");
                continue;
            }
            if (contract.selectors && !contract.selectors.has(transactions[j].selector)) {
                console.log(contract.address, "pruning", j, "(selector)");
                continue;
            }
            filteredTransactions.push(transactions[j]);
        }
        result[contract.address] = filteredTransactions;
    }
    return result;
}
exports.getTransactionsForContracts = getTransactionsForContracts;
//# sourceMappingURL=index.js.map