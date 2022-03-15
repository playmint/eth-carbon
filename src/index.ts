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
    blockNumber: number,
    input: string,
    gasUsed: string,
    isError: string
};

type Transaction = {
    blockNumber: number,
    input: string,
    gasUsed: number,
    isError: boolean,
    selector: string
};

type ABIField = {
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

async function get(url: string): Promise<string>
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

export async function getTransactionsForAddress(apiKey: string, address: string): Promise<Transaction[]>
{
    let transactions: Transaction[] = [];

    let startBlock = 0;
    while (true)
    {
        const responseStr = await get(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=asc&startBlock=${startBlock}&apikey=${apiKey}`);
        const response: Response<RawTransaction[]> = JSON.parse(responseStr);
        const page: Transaction[] = response.result.map((transaction: RawTransaction) => {
            return {
                blockNumber: transaction.blockNumber,
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

type ContractFilter = {
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
                        const responseStr = await get(`https://api.etherscan.io/api?module=proxy&action=eth_getStorageAt&address=${contract.address}&position=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc&tag=latest&apikey=${apiKey}`);
                        const response: RPCResponse = JSON.parse(responseStr);
                        
                        if (response.result != "0x0000000000000000000000000000000000000000000000000000000000000000")
                        {
                            // the result will be zero padded, addresses are 20 bytes,
                            // so we want to chop off 12 bytes (24 characters) + 2 for
                            // the 0x prefix
                            addressForABI = "0x" + response.result.substring(26);
                        }
                    }

                    const responseStr = await get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${addressForABI}&apikey=${apiKey}`);
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