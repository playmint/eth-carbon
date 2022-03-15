"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.estimateCO2 = exports.getTransactionsForContracts = void 0;
const https = __importStar(require("https"));
const keccak256_1 = __importDefault(require("keccak256"));
async function httpsGet(url) {
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
    let transactions = [];
    let startBlock = 0;
    while (true) {
        const responseStr = await httpsGet(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=asc&startBlock=${startBlock}&apikey=${apiKey}`);
        const response = JSON.parse(responseStr);
        const page = response.result.map((transaction) => {
            return {
                blockNumber: parseInt(transaction.blockNumber),
                timeStamp: parseInt(transaction.timeStamp),
                input: transaction.input,
                gasUsed: parseInt(transaction.gasUsed),
                isError: transaction.isError == "1",
                selector: transaction.input.substring(2, 10).toLowerCase()
            };
        });
        transactions = transactions.concat(page);
        if (page.length < 10000) {
            break;
        }
        // if we got a full page, then there's probably more transactions than
        // this, so use the block number of the last transaction as the
        // starting block to request the next batch of transactions.
        startBlock = transactions[transactions.length - 1].blockNumber;
        // we can't set start block to the block number of the last tx + 1, as
        // it's possible there are multiple transactions in the same block. So
        // what we do instead is remove all the transactions from the end of the
        // array which have that same block number, as the next request to 
        // re-fetch them and we don't want duplicates.
        while (transactions[transactions.length - 1].blockNumber == startBlock) {
            transactions.pop();
        }
    }
    return transactions;
}
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
                        const responseStr = await httpsGet(`https://api.etherscan.io/api?module=proxy&action=eth_getStorageAt&address=${contract.address}&position=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc&tag=latest&apikey=${apiKey}`);
                        const response = JSON.parse(responseStr);
                        if (response.result != "0x0000000000000000000000000000000000000000000000000000000000000000") {
                            // the result will be zero padded, addresses are 20 bytes,
                            // so we want to chop off 12 bytes (24 characters) + 2 for
                            // the 0x prefix
                            addressForABI = "0x" + response.result.substring(26);
                        }
                    }
                    const responseStr = await httpsGet(`https://api.etherscan.io/api?module=contract&action=getabi&address=${addressForABI}&apikey=${apiKey}`);
                    const response = JSON.parse(responseStr);
                    if (response.status != "1") {
                        throw `${contract.address}: failed to get ABI from etherscan`;
                    }
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
async function estimateCO2(apiKey, contracts) {
    // TODO attribution required
    const gasUsed = (await httpsGet("https://etherscan.io/chart/gasused?output=csv"))
        .split("\n") // split into rows
        .slice(1) // remove first row, this just contains the column headers
        .map((row) => {
        // all values are in quotes, they'll mess up int parsing if we leave 
        // them in
        const rowSplit = row.replace(/"/g, "").split(",");
        return {
            date: new Date(rowSplit[0]),
            timeStamp: parseInt(rowSplit[1]),
            value: parseInt(rowSplit[2])
        };
    });
    const emissions = (await httpsGet("https://kylemcdonald.github.io/ethereum-emissions/output/daily-ktco2.csv"))
        .split("\n")
        .slice(1)
        .map((row) => {
        const rowSplit = row.split(",");
        return {
            date: new Date(rowSplit[0]),
            lower: parseInt(rowSplit[1]),
            best: parseInt(rowSplit[2]),
            upper: parseInt(rowSplit[3])
        };
    });
    const transactions = await getTransactionsForContracts(apiKey, contracts);
    console.log(transactions, emissions, gasUsed);
}
exports.estimateCO2 = estimateCO2;
//# sourceMappingURL=index.js.map