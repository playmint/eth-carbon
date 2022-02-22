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
exports.getTransactions = void 0;
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
async function getTransactions() {
    // TODO paging
    const responseStr = await get("https://api.etherscan.io/api?module=account&action=txlist&address=0x938034c188c7671cabdb80d19cd31b71439516a9&sort=asc&apikey=MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T");
    const response = JSON.parse(responseStr);
    const transactions = response.result.map((transaction) => {
        return {
            input: transaction.input,
            gasUsed: parseInt(transaction.gasUsed),
            isError: transaction.isError == "1",
            isContractCreation: transaction.input.substring(10, 66) != "00000000000000000000000000000000000000000000000000000000",
            selector: transaction.input.substring(2, 10)
        };
    });
    return transactions;
}
exports.getTransactions = getTransactions;
//# sourceMappingURL=index.js.map