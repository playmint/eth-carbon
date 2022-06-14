import * as https from "https";
import keccak256 from "keccak256";

type Response<Type> = {
    status: string;
    message: string;
    result: Type;
};

type RPCResponse = {
    jsonrpc: string;
    id: Number;
    result: string;
};

type RawTransaction = {
    hash: string;
    blockNumber: string;
    timeStamp: string;
    input: string;
    gasUsed: string;
    isError: string;
};

export type Transaction = {
    hash: string;
    blockNumber: number;
    timeStamp: number;
    input: string;
    gasUsed: bigint;
    isError: boolean;
    selector: string;
};

export type ABIField = {
    name: string;
    type: string;
    components?: ABIField[];
};

export type ABIFunction = {
    type: "function" | "constructor" | "receive" | "fallback";
    name: string;
    inputs: ABIField[];
    outputs?: ABIField[];
    stateMutability: "pure" | "view" | "payable" | "nonpayable";
};

async function httpsGet(url: string): Promise<string> {
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

async function getTransactionsForAddress(apiKey: string, address: string): Promise<Transaction[]> {
    let transactions: Transaction[] = [];

    let startBlock = 0;
    while (true) {
        const responseStr = await httpsGet(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=asc&startBlock=${startBlock}&apikey=${apiKey}`);
        const response: Response<RawTransaction[]> = JSON.parse(responseStr);
        const page: Transaction[] = response.result.map((transaction: RawTransaction) => {
            return {
                hash: transaction.hash,
                blockNumber: parseInt(transaction.blockNumber),
                timeStamp: parseInt(transaction.timeStamp),
                input: transaction.input,
                gasUsed: BigInt(transaction.gasUsed),
                isError: transaction.isError == "1",
                selector: transaction.input.substring(2, 10).toLowerCase()
            };
        })

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

export type ContractFilter = {
    address: string;
    shouldIncludeContractCreation?: boolean;    // default is true
    shouldIncludeFailedTransactions?: boolean;  // default false
    selectors?: Set<string>;                    // default includes everything
    functions?: Set<string>;
    abi?: string | readonly ABIFunction[];
};

export async function getTransactionsForContracts(apiKey: string, contracts: ContractFilter[]): Promise<{ [address: string]: Transaction[] }> {
    let result: { [address: string]: Transaction[] } = {};

    for (let i = 0; i < contracts.length; ++i) {
        const contract = contracts[i];

        if (contract.shouldIncludeContractCreation == undefined) {
            // default to true for this
            contract.shouldIncludeContractCreation = true;
        }

        if (contract.functions) {
            if (!contract.selectors) {
                contract.selectors = new Set<string>();
            }

            let functionsToLookUp = new Map<string, ABIFunction | undefined>();
            contract.functions.forEach((func) => {
                // if any function sigs are just the name, then we'll need to look
                // the contract up on etherscan
                if (func.indexOf("(") == -1) {
                    functionsToLookUp.set(func, undefined); // we'll fill in the function later when we find it
                }
                else {
                    contract.selectors!.add(keccak256(func.replace(/ /g, "")).toString("hex").substring(0, 8));
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
                        const response: RPCResponse = JSON.parse(responseStr);

                        if (response.result != "0x0000000000000000000000000000000000000000000000000000000000000000") {
                            // the result will be zero padded, addresses are 20 bytes,
                            // so we want to chop off 12 bytes (24 characters) + 2 for
                            // the 0x prefix
                            addressForABI = "0x" + response.result.substring(26);
                        }
                    }

                    const responseStr = await httpsGet(`https://api.etherscan.io/api?module=contract&action=getabi&address=${addressForABI}&apikey=${apiKey}`);
                    const response: Response<string> = JSON.parse(responseStr);
                    if (response.status != "1") {
                        throw `${contract.address}: failed to get ABI from etherscan`;
                    }
                    contract.abi = JSON.parse(response.result);
                }

                const abi = contract.abi as ABIFunction[];
                for (let i = 0; i < abi.length; ++i) {
                    if (abi[i].type == "function" && functionsToLookUp.has(abi[i].name)) {
                        if (functionsToLookUp.get(abi[i].name) == undefined) {
                            functionsToLookUp.set(abi[i].name, abi[i]);

                            let sig = `${abi[i].name}(${abi[i].inputs.map((value) => value.type).join(",")})`;
                            contract.selectors!.add(keccak256(sig).toString("hex").substring(0, 8));
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

type GasUsedRow = {
    date: Date;
    timeStamp: number;
    value: bigint;
};

type EmissionsRow = {
    date: Date;
    lower: number;
    best: number;
    upper: number;
};

export type EmissionsEstimate = {
    gas: bigint;
    lower: number;
    best: number;
    upper: number;
};

export type EmissionsReport = {
    total: EmissionsEstimate;
    byAddress: Map<string, EmissionsReportForAddress>;
    byDate: Map<Date, EmissionsEstimate>;
}

export type EmissionsReportForAddress = {
    total: EmissionsEstimate;
    byDate: Map<Date, EmissionsReportForAddressAndDate>;
    bySelector: Map<string, EmissionsEstimate>;
}

export type EmissionsReportForAddressAndDate = {
    total: EmissionsEstimate;
    bySelector: Map<string, EmissionsEstimate>;
}

export async function estimateCO2(apiKey: string, contracts: ContractFilter[]): Promise<EmissionsReport> {
    const networkGasUsed: GasUsedRow[] = await getNetworkGasUsedTable();
    const networkEmissions: EmissionsRow[] = await getNetworkEmissionsTable();

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

    const transactions = await getTransactionsForContracts(apiKey, contracts);

    const report: EmissionsReport = {
        total: { gas: 0n, lower: 0, best: 0, upper: 0 },
        byAddress: new Map<string, EmissionsReportForAddress>(),
        byDate: new Map<Date, EmissionsEstimate>()
    };

    for (const contractAddress in transactions) {
        const byAddress = {
            total: { gas: 0n, lower: 0, best: 0, upper: 0 },
            byDate: new Map<Date, EmissionsReportForAddressAndDate>(),
            bySelector: new Map<string, EmissionsEstimate>()
        };
        report.byAddress.set(contractAddress, byAddress);

        for (let i = 0; i < transactions[contractAddress].length; ++i) {
            const transaction = transactions[contractAddress][i];

            const day = Math.floor(transaction.timeStamp / secondsPerDay);
            const rowIndex = clamp(0, networkGasUsed.length - 1, day - dayToIndexOffset);
            const date = networkGasUsed[rowIndex].date;

            if (!byAddress.byDate.has(date)) {
                byAddress.byDate.set(date, {
                    total: { gas: 0n, lower: 0, best: 0, upper: 0 },
                    bySelector: new Map<string, EmissionsEstimate>()
                });
            }
            const byAddressAndDate = byAddress.byDate.get(date)!;

            if (!byAddressAndDate.bySelector.has(transaction.selector)) {
                byAddressAndDate.bySelector.set(transaction.selector, { gas: 0n, lower: 0, best: 0, upper: 0 });
            }
            const byAddressAndDateAndSelector = byAddressAndDate.bySelector.get(transaction.selector)!;

            if (!report.byDate.has(date)) {
                report.byDate.set(date, { gas: 0n, lower: 0, best: 0, upper: 0 });
            }
            const byDate = report.byDate.get(date)!;

            byAddressAndDate.total.gas += transaction.gasUsed;
            byAddressAndDateAndSelector.gas += transaction.gasUsed;
            byDate.gas += transaction.gasUsed;
        }
    }

    report.byDate.forEach((byDate: EmissionsEstimate, date: Date) => {
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
        report.total.gas += byDate.gas;
        report.total.lower += byDate.lower;
        report.total.best += byDate.best;
        report.total.upper += byDate.upper;

        // calculate missions which are broken up per address/selector
        report.byAddress.forEach((byAddress: EmissionsReportForAddress, address: string) => {
            if (byAddress.byDate.has(date)) {
                const byAddressAndDate = byAddress.byDate.get(date)!;

                // calculate for address and date
                calculateEmissionsEstimate(byAddressAndDate.total, emissionsRow, networkGasUsedNum);

                // update the address total
                byAddress.total.gas += byAddressAndDate.total.gas;
                byAddress.total.lower += byAddressAndDate.total.lower;
                byAddress.total.best += byAddressAndDate.total.best;
                byAddress.total.upper += byAddressAndDate.total.upper;

                byAddressAndDate.bySelector.forEach((byAddressAndDateAndSelector: EmissionsEstimate, selector: string) => {
                    // calculate for address, date & selector
                    calculateEmissionsEstimate(byAddressAndDateAndSelector, emissionsRow, networkGasUsedNum);

                    // update selector total
                    if (!byAddress.bySelector.has(selector)) {
                        byAddress.bySelector.set(selector, { gas: 0n, lower: 0, best: 0, upper: 0 });
                    }
                    const byAddressAndSelector = byAddress.bySelector.get(selector)!;
                    byAddressAndSelector.lower += byAddressAndDateAndSelector.lower;
                    byAddressAndSelector.best += byAddressAndDateAndSelector.best;
                    byAddressAndSelector.upper += byAddressAndDateAndSelector.upper;
                });
            }
        });
    });

    return report;
}

function clamp(min: number, max: number, value: number): number {
    return Math.max(Math.min(value, max), min);
}

function calculateEmissionsEstimate(
    emissions: EmissionsEstimate,
    networkEmissions: EmissionsRow,
    networkGasUsageForDay: number) {
    const gasNum = Number(emissions.gas);
    emissions.lower = (gasNum * networkEmissions.lower) / networkGasUsageForDay;
    emissions.best = (gasNum * networkEmissions.best) / networkGasUsageForDay;
    emissions.upper = (gasNum * networkEmissions.upper) / networkGasUsageForDay;
}

function datesAreSameDay(a: Date, b: Date): boolean {
    return a.getUTCFullYear() == b.getUTCFullYear() &&
        a.getUTCMonth() == b.getUTCMonth() &&
        a.getUTCDate() == b.getUTCDate();
}

async function getNetworkGasUsedTable(): Promise<GasUsedRow[]> {
    const csvRows = (await httpsGet("https://etherscan.io/chart/gasused?output=csv")).split("\n");

    // remove first row, this just contains the column headers
    csvRows.shift();

    // remove possibly empty final row
    if (csvRows[csvRows.length - 1] == "") {
        csvRows.pop();
    }

    return csvRows.map((row) => { // parse rows
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

async function getNetworkEmissionsTable(): Promise<EmissionsRow[]> {
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
            lower: parseInt(rowSplit[1]) * 1000, // convert from kt -> t
            best: parseInt(rowSplit[2]) * 1000,
            upper: parseInt(rowSplit[3]) * 1000
        };
    });
}