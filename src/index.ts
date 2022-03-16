import * as https from "https";
import keccak256 from "keccak256";

type Response<Type> = {
    status: string,
    message: string,
    result: Type
};

type RPCResponse = {
    jsonrpc: string,
    id: Number,
    result: string
};

type RawTransaction = {
    blockNumber: string,
    timeStamp: string,
    input: string,
    gasUsed: string,
    isError: string
};

export type Transaction = {
    blockNumber: number,
    timeStamp: number,
    input: string,
    gasUsed: number,
    isError: boolean,
    selector: string
};

export type ABIField = {
    name: string,
    type: string,
    components?: ABIField[]
};

export type ABIFunction = {
    type: "function" | "constructor" | "receive" | "fallback",
    name: string,
    inputs: ABIField[],
    outputs?: ABIField[],
    stateMutability: "pure" | "view" | "payable" | "nonpayable"
};

async function httpsGet(url: string): Promise<string>
{
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = "";

            response.on("data", (chunk) => {
                data += chunk;
            });

            response.on("end", () =>
            {
                resolve(data);
            });
        }).on("error", (e) => {
            reject(e);
        });
    });
}

async function getTransactionsForAddress(apiKey: string, address: string): Promise<Transaction[]>
{
    let transactions: Transaction[] = [];

    let startBlock = 0;
    while (true)
    {
        const responseStr = await httpsGet(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=asc&startBlock=${startBlock}&apikey=${apiKey}`);
        const response: Response<RawTransaction[]> = JSON.parse(responseStr);
        const page: Transaction[] = response.result.map((transaction: RawTransaction) => {
            return {
                blockNumber: parseInt(transaction.blockNumber),
                timeStamp: parseInt(transaction.timeStamp),
                input: transaction.input,
                gasUsed: parseInt(transaction.gasUsed),
                isError: transaction.isError == "1",
                selector: transaction.input.substring(2, 10).toLowerCase()
            };
        })

        transactions = transactions.concat(page);

        if (page.length < 10000)
        {
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
        while (transactions[transactions.length - 1].blockNumber == startBlock)
        {
            transactions.pop();
        }
    }
    
    return transactions;
}

export type ContractFilter = {
    address: string,
    shouldIncludeContractCreation?: boolean,    // default is true
    shouldIncludeFailedTransactions?: boolean,  // default false
    selectors?: Set<string>,                    // default includes everything
    functions?: Set<string>,
    abi?: string | readonly ABIFunction[]
};

export async function getTransactionsForContracts(apiKey: string, contracts: ContractFilter[]): Promise<{[address: string]: Transaction[]}>
{
    let result: {[address: string]: Transaction[]} = {};

    for (let i = 0; i < contracts.length; ++i)
    {
        const contract = contracts[i];

        if (contract.shouldIncludeContractCreation == undefined)
        {
            // default to true for this
            contract.shouldIncludeContractCreation = true;
        }

        if (contract.functions)
        {
            if (!contract.selectors)
            {
                contract.selectors = new Set<string>();
            }

            let functionsToLookUp = new Map<string, ABIFunction | undefined>();
            contract.functions.forEach((func) =>
            {
                // if any function sigs are just the name, then we'll need to look
                // the contract up on etherscan
                if (func.indexOf("(") == -1)
                {
                    functionsToLookUp.set(func, undefined); // we'll fill in the function later when we find it
                }
                else
                {
                    contract.selectors!.add(keccak256(func.replace(/ /g, "")).toString("hex").substring(0, 8));
                }
            });

            if (functionsToLookUp.size > 0)
            {
                if (contract.abi)
                {
                    if (typeof(contract.abi) === "string")
                    {
                        contract.abi = JSON.parse(contract.abi);
                    }
                }
                else
                {
                    // no ABI, attempt to look it up on etherscan
                    let addressForABI = contract.address;

                    {
                        const responseStr = await httpsGet(`https://api.etherscan.io/api?module=proxy&action=eth_getStorageAt&address=${contract.address}&position=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc&tag=latest&apikey=${apiKey}`);
                        const response: RPCResponse = JSON.parse(responseStr);
                        
                        if (response.result != "0x0000000000000000000000000000000000000000000000000000000000000000")
                        {
                            // the result will be zero padded, addresses are 20 bytes,
                            // so we want to chop off 12 bytes (24 characters) + 2 for
                            // the 0x prefix
                            addressForABI = "0x" + response.result.substring(26);
                        }
                    }

                    const responseStr = await httpsGet(`https://api.etherscan.io/api?module=contract&action=getabi&address=${addressForABI}&apikey=${apiKey}`);
                    const response: Response<string> = JSON.parse(responseStr);
                    if (response.status != "1")
                    {
                        throw `${contract.address}: failed to get ABI from etherscan`;
                    }
                    contract.abi = JSON.parse(response.result);
                }
                
                const abi = contract.abi as ABIFunction[];
                for (let i = 0; i < abi.length; ++i)
                {
                    if (abi[i].type == "function" && functionsToLookUp.has(abi[i].name))
                    {
                        if (functionsToLookUp.get(abi[i].name) == undefined)
                        {
                            functionsToLookUp.set(abi[i].name, abi[i]);

                            let sig = `${abi[i].name}(${abi[i].inputs.map((value) => value.type).join(",")})`;
                            contract.selectors!.add(keccak256(sig).toString("hex").substring(0, 8));
                        }
                        else
                        {
                            throw `${contract.address}: multiple functions found with name '${abi[i].name}'`;
                        }
                    }
                }

                functionsToLookUp.forEach((value, key) =>
                {
                    if (value == undefined)
                    {
                        throw `${contract.address}: no function found with name '${key}'`;
                    }
                });
            }
        }

        let filteredTransactions = [];
        let transactions = await getTransactionsForAddress(apiKey, contract.address);

        if (contract.shouldIncludeContractCreation)
        {
            filteredTransactions.push(transactions[0]);
        }
        
        for (let j = 1; j < transactions.length; ++j)
        {
            if (!contract.shouldIncludeFailedTransactions && transactions[j].isError)
            {
                continue;
            }

            if (contract.selectors && !contract.selectors.has(transactions[j].selector))
            {
                continue;
            }

            filteredTransactions.push(transactions[j]);
        }

        result[contract.address] = filteredTransactions;
    }
    
    return result;
}

type GasUsedRow = {
    date: Date,
    timeStamp: number,
    value: number
};

type EmissionsRow = {
    date: Date,
    lower: number,
    best: number,
    upper: number
};

export type EmissionsEstimate = {
    lower: number,
    best: number,
    upper: number
};

export type EmissionsReport = {
    dailyEmissions: Map<Date, EmissionsEstimate>,
    total: EmissionsEstimate
}

export async function estimateCO2(apiKey: string, contracts: ContractFilter[]): Promise<EmissionsReport>
{
    const networkGasUsed: GasUsedRow[] = (await httpsGet("https://etherscan.io/chart/gasused?output=csv"))
        .split("\n")    // split into rows
        .slice(1)       // remove first row, this just contains the column headers
        .map((row) => { // parse rows
            // all values are in quotes, they'll mess up int parsing if we leave 
            // them in
            const rowSplit = row.replace(/"/g, "").split(",");
            return {
                date: new Date(rowSplit[0]), 
                timeStamp: parseInt(rowSplit[1]), 
                value: parseInt(rowSplit[2])
            };
        }); 

    const networkEmissions: EmissionsRow[] = (await httpsGet("https://kylemcdonald.github.io/ethereum-emissions/output/daily-ktco2.csv"))
        .split("\n")
        .slice(1)
        .map((row) => {
            const rowSplit = row.split(",");
            return {
                date: new Date(rowSplit[0]),
                lower: parseInt(rowSplit[1]) * 1000, // convert from kt -> t
                best: parseInt(rowSplit[2]) * 1000,
                upper: parseInt(rowSplit[3]) * 1000
            };
        });

    // timestamps are in seconds, so if we divide by the number of seconds in
    // in the day we can get a number to represent the day. so if we want to
    // look up the row in gasUsed/emissions, to get its index in those arrays
    // we subtract the day of the first row in the array.
    const secondsPerDay = 60 * 60 * 24;
    const dayToIndexOffset = Math.floor(networkGasUsed[0].timeStamp / secondsPerDay);

    // for the dayToIndexOffset to work for both networkEmissions and networkGasUsed
    // arrays, their first entry must be the same date. In testing this seems to
    // be the case, but worth a sanity check
    if (networkGasUsed[0].date.getFullYear() != networkEmissions[0].date.getFullYear() ||
        networkGasUsed[0].date.getMonth() != networkEmissions[0].date.getMonth() ||
        networkGasUsed[0].date.getDate() != networkEmissions[0].date.getDate())
    {
        throw "date of first row of network gas used and network emissions csvs don't match";
    }

    const transactions = await getTransactionsForContracts(apiKey, contracts);
    let gasUsedPerDay = new Map<number, number>();
    for (const contractAddress in transactions)
    {
        for (let i = 0; i < transactions[contractAddress].length; ++i)
        {
            const day = Math.floor(transactions[contractAddress][i].timeStamp / secondsPerDay);
            let rowIndex = day - dayToIndexOffset;
            if (rowIndex < 0 || rowIndex >= networkGasUsed.length)
            {
                console.log("row index will be clamped", rowIndex);
                rowIndex = clamp(0, networkGasUsed.length - 1, rowIndex);
            }

            let current = gasUsedPerDay.get(rowIndex);
            if (!current)
            {
                current = 0;
            }
            
            gasUsedPerDay.set(rowIndex, current + transactions[contractAddress][i].gasUsed);
        }
    }
    
    let report: EmissionsReport = {
        dailyEmissions: new Map<Date, EmissionsEstimate>(),
        total: {
            lower: 0,
            best: 0,
            upper: 0
        }
    };

    gasUsedPerDay.forEach((value, key) => {
        // emissions array should be the same length as networkGasUsed, but just
        // to be sure
        const emissionsRow = Math.min(key, networkEmissions.length - 1);
        const lower = (value * networkEmissions[emissionsRow].lower) / networkGasUsed[key].value;
        const best = (value * networkEmissions[emissionsRow].best) / networkGasUsed[key].value;
        const upper = (value * networkEmissions[emissionsRow].upper) / networkGasUsed[key].value;

        report.dailyEmissions.set(networkGasUsed[key].date, {
            lower: lower,
            best: best,
            upper: upper
        });

        report.total.lower += lower;
        report.total.best += best;
        report.total.upper += upper;
    });

    return report;
}

function clamp(min: number, max: number, value: number): number
{
    return Math.max(Math.min(value, max), min);
}