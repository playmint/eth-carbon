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
async function default_1() {
    /*let provider = new ethers.providers.EtherscanProvider("homestead", "MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T");
    console.log(await provider.getBalance("0xfE4Aab053FED3cFbB7e5f6434e1585b4F17CC207"));

    let txns = await provider.getHistory("0x38065291fdce1a752afd725e96ff75e1c38ad6aa");
    console.log(txns);*/
    // TODO paging
    const responseStr = await get("https://api.etherscan.io/api?module=account&action=txlist&address=0x38065291fdce1a752afd725e96ff75e1c38ad6aa&sort=asc&apikey=MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T");
    const response = JSON.parse(responseStr);
    response.result = response.result.map((transaction) => {
        transaction.gasUsed = parseInt(transaction.gasUsed);
        return transaction;
    });
    console.log(response.result);
}
exports.default = default_1;
//# sourceMappingURL=index.js.map