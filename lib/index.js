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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionsForContracts = exports.getTransactionsForAddress = void 0;
const https = __importStar(require("https"));
const keccak256_1 = __importDefault(require("keccak256"));
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
        if (contract.shouldIncludeContractCreation == undefined) {
            // default to true for this
            contract.shouldIncludeContractCreation = true;
        }
        if (contract.functions) {
            if (!contract.selectors) {
                contract.selectors = new Set();
            }
            let functionsToLookUp = new Map();
            contract.functions.forEach((func) => {
                // if any function sigs are just the name, then we'll need to look
                // the contract up on etherscan
                if (func.indexOf("(") == -1) {
                    functionsToLookUp.set(func, undefined); // we'll fill in the function later when we find it
                }
                else {
                    contract.selectors.add((0, keccak256_1.default)(func.replace(/ /g, "")).toString("hex").substring(0, 8));
                }
            });
            if (functionsToLookUp.size > 0) {
                if (contract.abi) {
                    if (typeof (contract.abi) === "string") {
                        contract.abi = JSON.parse(contract.abi);
                    }
                }
                else {
                    // no ABI, attempt to look it up on etherscan
                    let addressForABI = contract.address;
                    {
                        const responseStr = await get(`https://api.etherscan.io/api?module=proxy&action=eth_getStorageAt&address=${contract.address}&position=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc&tag=latest&apikey=${apiKey}`);
                        const response = JSON.parse(responseStr);
                        if (response.result != "0x0000000000000000000000000000000000000000000000000000000000000000") {
                            console.log(contract.address, "is a proxy");
                            // the result will be zero padded, addresses are 20 bytes,
                            // so we want to chop off 12 bytes (24 characters) + 2 for
                            // the 0x prefix
                            addressForABI = "0x" + response.result.substring(26);
                        }
                        else {
                            console.log(contract.address, "is not a proxy");
                        }
                    }
                    // TODO detect if etherscan doesn't have the ABI and return a useful error
                    const responseStr = await get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${addressForABI}&apikey=${apiKey}`);
                    const response = JSON.parse(responseStr);
                    contract.abi = JSON.parse(response.result);
                }
                const abi = contract.abi;
                for (let i = 0; i < abi.length; ++i) {
                    if (abi[i].type == "function" && functionsToLookUp.has(abi[i].name)) {
                        if (functionsToLookUp.get(abi[i].name) == undefined) {
                            functionsToLookUp.set(abi[i].name, abi[i]);
                            let sig = `${abi[i].name}(${abi[i].inputs.map((value) => value.type).join(",")})`;
                            contract.selectors.add((0, keccak256_1.default)(sig).toString("hex").substring(0, 8));
                        }
                        else {
                            throw `${contract.address}: multiple functions found with name '${abi[i].name}'`;
                        }
                    }
                }
                functionsToLookUp.forEach((value, key) => {
                    if (value == undefined) {
                        throw `${contract.address}: no function found with name '${key}'`;
                    }
                });
            }
        }
        // TODO if it's only wanting contract creation could optimise the etherscan call
        let filteredTransactions = [];
        let transactions = await getTransactionsForAddress(apiKey, contract.address);
        if (contract.shouldIncludeContractCreation) {
            filteredTransactions.push(transactions[0]);
        }
        for (let j = 1; j < transactions.length; ++j) {
            if (!contract.shouldIncludeFailedTransactions && transactions[j].isError) {
                continue;
            }
            if (contract.selectors && !contract.selectors.has(transactions[j].selector)) {
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