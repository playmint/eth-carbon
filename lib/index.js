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
exports.reportToCSV = exports.reportToString = exports.estimateCO2 = exports.populateSelectorsForContractFilter = exports.getTransactionsForContracts = void 0;
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
async function getTransactionsForAddress(address, apiKey) {
    let transactions = [];
    let startBlock = 0;
    while (true) {
        const responseStr = await httpsGet(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=asc&startBlock=${startBlock}&apikey=${apiKey}`);
        const response = JSON.parse(responseStr);
        const page = response.result.map((transaction) => {
            return {
                hash: transaction.hash,
                blockNumber: parseInt(transaction.blockNumber),
                timeStamp: parseInt(transaction.timeStamp),
                input: transaction.input,
                gasUsed: BigInt(transaction.gasUsed),
                isError: transaction.isError == "1",
                selector: transaction.input.substring(2, 10).toLowerCase(),
                isContractCreation: transaction.contractAddress != null && transaction.contractAddress != ""
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
async function getTransactionsForContracts(contracts, apiKey) {
    let result = {};
    for (let i = 0; i < contracts.length; ++i) {
        const contract = contracts[i];
        if (contract.shouldIncludeContractCreation === undefined) {
            // default to true for this
            contract.shouldIncludeContractCreation = true;
        }
        await populateSelectorsForContractFilter(contract, apiKey);
        let filteredTransactions = [];
        let transactions = await getTransactionsForAddress(contract.address, apiKey);
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
async function populateSelectorsForContractFilter(contractFilter, apiKey) {
    if (contractFilter.selectorToFunction === undefined) {
        contractFilter.selectorToFunction = {};
        if (contractFilter.abi === undefined) {
            if (apiKey !== undefined) {
                let addressForABI = contractFilter.address;
                {
                    // check if it's a proxy contract
                    const responseStr = await httpsGet(`https://api.etherscan.io/api?module=proxy&action=eth_getStorageAt&address=${contractFilter.address}&position=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc&tag=latest&apikey=${apiKey}`);
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
                if (response.status == "1") {
                    contractFilter.abi = JSON.parse(response.result);
                }
                else {
                    console.warn(`${contractFilter.address}: failed to get ABI from etherscan`);
                }
            }
        }
        else if (typeof (contractFilter.abi) === "string") {
            contractFilter.abi = JSON.parse(contractFilter.abi);
        }
        if (contractFilter.abi !== undefined) {
            const abi = contractFilter.abi;
            for (const func of abi) {
                if (func.type == "function") {
                    const sig = `${func.name}(${func.inputs.map((value) => value.type).join(",")})`;
                    const selector = (0, keccak256_1.default)(sig).toString("hex").substring(0, 8);
                    contractFilter.selectorToFunction[selector] = sig;
                }
            }
        }
    }
    if (contractFilter.functions) {
        if (!contractFilter.selectors) {
            contractFilter.selectors = new Set();
        }
        contractFilter.functions.forEach((func) => {
            // if any function sigs are just the name, we need to figure out the full sig
            if (func.indexOf("(") == -1) {
                const selectors = Object.keys(contractFilter.selectorToFunction).filter((selector) => {
                    const sig = contractFilter.selectorToFunction[selector];
                    const name = sig.substring(0, sig.indexOf("("));
                    return name == func;
                });
                if (selectors.length == 0) {
                    throw `'${func}' not found in abi`;
                }
                else if (selectors.length > 1) {
                    let errorStr = `'${func}' is ambiguous, could be:\n`;
                    for (const selector of selectors) {
                        errorStr += contractFilter.selectorToFunction[selector] + "\n";
                    }
                    throw errorStr;
                }
                contractFilter.selectors.add(selectors[0]);
            }
            else {
                const sig = func.replace(/ /g, "");
                const selector = (0, keccak256_1.default)(sig).toString("hex").substring(0, 8);
                contractFilter.selectors.add(selector);
                // if we don't have an abi then this selector might not be in the map already
                if (contractFilter.selectorToFunction[selector] === undefined) {
                    contractFilter.selectorToFunction[selector] = sig;
                }
            }
        });
    }
}
exports.populateSelectorsForContractFilter = populateSelectorsForContractFilter;
async function estimateCO2(apiKey, contracts) {
    const networkGasUsed = await getNetworkGasUsedTable();
    const networkEmissions = await getNetworkEmissionsTable();
    // timestamps are in seconds, so if we divide by the number of seconds in
    // in the day we can get a number to represent the day. so if we want to
    // look up the row in gasUsed/emissions, to get its index in those arrays
    // we subtract the day of the first row in the array.
    const secondsPerDay = 60 * 60 * 24;
    const dayToIndexOffset = Math.floor(networkGasUsed[0].timeStamp / secondsPerDay);
    // for the dayToIndexOffset to work for both networkEmissions and networkGasUsed
    // arrays, their first entry must be the same date. In testing this seems to
    // be the case, but worth a sanity check
    if (!datesAreSameDay(networkGasUsed[0].date, networkEmissions[0].date)) {
        throw "date of first row of network gas used and network emissions csvs don't match";
    }
    const transactions = await getTransactionsForContracts(contracts, apiKey);
    const report = {
        total: { txCount: 0, gas: 0n, lower: 0, best: 0, upper: 0 },
        byAddress: {},
        byDate: {}
    };
    for (const contractAddress in transactions) {
        const byAddress = {
            total: { txCount: 0, gas: 0n, lower: 0, best: 0, upper: 0 },
            byDate: {},
            bySelector: {}
        };
        report.byAddress[contractAddress] = byAddress;
        for (let i = 0; i < transactions[contractAddress].length; ++i) {
            const transaction = transactions[contractAddress][i];
            const day = Math.floor(transaction.timeStamp / secondsPerDay);
            const rowIndex = clamp(0, networkGasUsed.length - 1, day - dayToIndexOffset);
            const date = networkGasUsed[rowIndex].date;
            const dateStr = date.toISOString();
            if (byAddress.byDate[dateStr] === undefined) {
                byAddress.byDate[dateStr] = {
                    total: { txCount: 0, gas: 0n, lower: 0, best: 0, upper: 0 },
                    bySelector: {}
                };
            }
            const byAddressAndDate = byAddress.byDate[dateStr];
            if (byAddressAndDate.bySelector[transaction.selector] === undefined) {
                byAddressAndDate.bySelector[transaction.selector] = { txCount: 0, gas: 0n, lower: 0, best: 0, upper: 0 };
            }
            const byAddressAndDateAndSelector = byAddressAndDate.bySelector[transaction.selector];
            if (report.byDate[dateStr] === undefined) {
                report.byDate[dateStr] = { txCount: 0, gas: 0n, lower: 0, best: 0, upper: 0 };
            }
            const byDate = report.byDate[dateStr];
            byAddressAndDate.total.gas += transaction.gasUsed;
            byAddressAndDateAndSelector.gas += transaction.gasUsed;
            byDate.gas += transaction.gasUsed;
            ++byAddressAndDate.total.txCount;
            ++byAddressAndDateAndSelector.txCount;
            ++byDate.txCount;
        }
    }
    for (const dateStr in report.byDate) {
        const byDate = report.byDate[dateStr];
        const date = new Date(Date.parse(dateStr));
        const gasRow = Math.floor((date.getTime() / 1000) / secondsPerDay) - dayToIndexOffset;
        if (!datesAreSameDay(networkGasUsed[gasRow].date, date)) {
            throw "date doesn't match that in networkGasUsed table";
        }
        const networkGasUsedNum = Number(networkGasUsed[gasRow].value);
        // emissions array should be the same length as networkGasUsed, but just
        // to be sure
        const emissionsRowIdx = Math.min(gasRow, networkEmissions.length - 1);
        const emissionsRow = networkEmissions[emissionsRowIdx];
        // calculate emissions for day
        calculateEmissionsEstimate(byDate, emissionsRow, networkGasUsedNum);
        // add to total emissions
        report.total.txCount += byDate.txCount;
        report.total.gas += byDate.gas;
        report.total.lower += byDate.lower;
        report.total.best += byDate.best;
        report.total.upper += byDate.upper;
        // calculate missions which are broken up per address/selector
        for (const address in report.byAddress) {
            const byAddress = report.byAddress[address];
            if (byAddress.byDate[dateStr] !== undefined) {
                const byAddressAndDate = byAddress.byDate[dateStr];
                // calculate for address and date
                calculateEmissionsEstimate(byAddressAndDate.total, emissionsRow, networkGasUsedNum);
                // update the address total
                byAddress.total.txCount += byAddressAndDate.total.txCount;
                byAddress.total.gas += byAddressAndDate.total.gas;
                byAddress.total.lower += byAddressAndDate.total.lower;
                byAddress.total.best += byAddressAndDate.total.best;
                byAddress.total.upper += byAddressAndDate.total.upper;
                for (const selector in byAddressAndDate.bySelector) {
                    const byAddressAndDateAndSelector = byAddressAndDate.bySelector[selector];
                    // calculate for address, date & selector
                    calculateEmissionsEstimate(byAddressAndDateAndSelector, emissionsRow, networkGasUsedNum);
                    // update selector total
                    if (byAddress.bySelector[selector] === undefined) {
                        byAddress.bySelector[selector] = { txCount: 0, gas: 0n, lower: 0, best: 0, upper: 0 };
                    }
                    const byAddressAndSelector = byAddress.bySelector[selector];
                    byAddressAndSelector.txCount += byAddressAndDateAndSelector.txCount;
                    byAddressAndSelector.gas += byAddressAndDateAndSelector.gas;
                    byAddressAndSelector.lower += byAddressAndDateAndSelector.lower;
                    byAddressAndSelector.best += byAddressAndDateAndSelector.best;
                    byAddressAndSelector.upper += byAddressAndDateAndSelector.upper;
                }
                ;
            }
        }
        ;
    }
    ;
    // lookup selectors for readability
    for (const contract of contracts) {
        const byAddress = report.byAddress[contract.address];
        // may not exist (if no txns are found matching the filter)
        if (byAddress === undefined) {
            continue;
        }
        if (contract.selectorToFunction === undefined) {
            contract.selectorToFunction = {};
        }
        // if we get contract creation then it'll be the first txn
        if (transactions[contract.address][0].isContractCreation) {
            contract.selectorToFunction[transactions[contract.address][0].selector] = "contractCreation";
        }
        const lookupSelectors = (emissionsForSelectors) => {
            for (const selector in emissionsForSelectors) {
                const func = contract.selectorToFunction[selector];
                if (func !== undefined) {
                    emissionsForSelectors[func] = emissionsForSelectors[selector];
                }
            }
        };
        lookupSelectors(byAddress.bySelector);
        for (const dateStr in byAddress.byDate) {
            lookupSelectors(byAddress.byDate[dateStr].bySelector);
        }
        ;
    }
    return report;
}
exports.estimateCO2 = estimateCO2;
function clamp(min, max, value) {
    return Math.max(Math.min(value, max), min);
}
function calculateEmissionsEstimate(emissions, networkEmissions, networkGasUsageForDay) {
    const gasNum = Number(emissions.gas);
    emissions.lower = (gasNum * networkEmissions.lower) / networkGasUsageForDay;
    emissions.best = (gasNum * networkEmissions.best) / networkGasUsageForDay;
    emissions.upper = (gasNum * networkEmissions.upper) / networkGasUsageForDay;
}
function datesAreSameDay(a, b) {
    return a.getUTCFullYear() == b.getUTCFullYear() &&
        a.getUTCMonth() == b.getUTCMonth() &&
        a.getUTCDate() == b.getUTCDate();
}
async function getNetworkGasUsedTable() {
    const csvRows = (await httpsGet("https://etherscan.io/chart/gasused?output=csv")).split("\n");
    // remove first row, this just contains the column headers
    csvRows.shift();
    // remove possibly empty final row
    if (csvRows[csvRows.length - 1] == "") {
        csvRows.pop();
    }
    return csvRows.map((row) => {
        // all values are in quotes, they'll mess up int parsing if we leave 
        // them in
        const rowSplit = row.replace(/"/g, "").split(",");
        return {
            date: new Date(parseInt(rowSplit[1]) * 1000),
            timeStamp: parseInt(rowSplit[1]),
            value: BigInt(rowSplit[2])
        };
    });
}
async function getNetworkEmissionsTable() {
    const csvRows = (await httpsGet("https://kylemcdonald.github.io/ethereum-emissions/output/daily-ktco2.csv")).split("\n");
    // remove first row, this just contains the column headers
    csvRows.shift();
    // remove possibly empty final row
    if (csvRows[csvRows.length - 1] == "") {
        csvRows.pop();
    }
    return csvRows.map((row) => {
        const rowSplit = row.split(",");
        return {
            date: new Date(rowSplit[0]),
            lower: parseInt(rowSplit[1]) * 1000,
            best: parseInt(rowSplit[2]) * 1000,
            upper: parseInt(rowSplit[3]) * 1000
        };
    });
}
function reportToString(report, contracts) {
    let s = "";
    const estimatetoString = function (est) {
        return `best:${est.best}, lower:${est.lower}, upper:${est.upper}`;
    };
    s += `Total - ${estimatetoString(report.total)}\n`;
    s += "==========================================================================\n";
    for (const contract of contracts) {
        const byAddress = report.byAddress[contract.address];
        if (byAddress === undefined) {
            continue;
        }
        s += `${contract.address} - ${estimatetoString(byAddress.total)}\n`;
        for (const selector in byAddress.bySelector) {
            // selectors may have been looked up, so we only want the raw selectors
            if (selector.includes("(") || selector == "contractCreation") {
                continue;
            }
            const func = contract.selectorToFunction ? contract.selectorToFunction[selector] : undefined;
            s += `    ${selector}${func !== undefined ? `|${func}` : ""} - ${estimatetoString(byAddress.bySelector[selector])}\n`;
        }
        s += "--------------------------------------------------------------------------\n";
    }
    return s;
}
exports.reportToString = reportToString;
function reportToCSV(report, contracts) {
    const headers = ["Address", "Function", "Selector", "Tx Count", "Gas", "Best Guess", "Lower", "Upper"];
    let s = `${headers.join(",")}\n`;
    const makeRow = function (address, func, selector, est) {
        return [address, func, selector, est.txCount, est.gas, est.best, est.lower, est.upper].join(",") + "\n";
    };
    s += makeRow("Total", "", "", report.total);
    for (const contract of contracts) {
        const byAddress = report.byAddress[contract.address];
        if (byAddress === undefined) {
            continue;
        }
        s += makeRow(contract.address, "", "", byAddress.total);
        for (const selector in byAddress.bySelector) {
            // selectors may have been looked up, so we only want the raw selectors
            if (selector.includes("(") || selector == "contractCreation") {
                continue;
            }
            const func = contract.selectorToFunction ? contract.selectorToFunction[selector] : undefined;
            s += makeRow("", func !== undefined ? `"${func}"` : "", selector, byAddress.bySelector[selector]);
        }
    }
    return s;
}
exports.reportToCSV = reportToCSV;
//# sourceMappingURL=index.js.map