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
    input: string,
    gasUsed: string,
    isError: string
};

type Transaction = {
    input: string,
    gasUsed: number,
    isError: boolean,
    selector: string
};

type ABIItem = {
    type: string,
    inputs:
}

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
    // TODO paging 
    const responseStr = await get(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=asc&apikey=${apiKey}`);
    const response: Response<RawTransaction[]> = JSON.parse(responseStr);
    const transactions: Transaction[] = response.result.map((transaction: RawTransaction) => {
        return {
            input: transaction.input,
            gasUsed: parseInt(transaction.gasUsed),
            isError: transaction.isError == "1",
            selector: transaction.input.substring(2, 10).toLowerCase()
        };
    });
    
    return transactions;
}

type ContractFilter = {
    address: string,
    shouldIncludeContractCreation?: boolean,    // default is true
    shouldIncludeFailedTransactions?: boolean,  // default false
    selectors?: Set<string>,                    // default includes everything
    functions?: Set<string>
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
            // if any function sigs are just the name, then we'll need to look
            // the contract up on etherscan
            let functionsToLookUp = [];
            contract.functions.forEach((func) =>
            {
                if (func.indexOf("(") == -1)
                {
                    functionsToLookUp.push(func);
                }
            });

            if (functionsToLookUp.length > 0)
            {
                let addressForABI = contract.address;

                {
                    const responseStr = await get(`https://api.etherscan.io/api?module=proxy&action=eth_getStorageAt&address=${contract.address}&position=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc&tag=latest&apikey=${apiKey}`);
                    const response: RPCResponse = JSON.parse(responseStr);
                    
                    if (response.result != "0x0000000000000000000000000000000000000000000000000000000000000000")
                    {
                        console.log(contract.address, "is a proxy");

                        // the result will be zero padded, addresses are 20 bytes,
                        // so we want to chop off 12 bytes (24 characters) + 2 for
                        // the 0x prefix
                        addressForABI = "0x" + response.result.substring(26);
                    }
                    else
                    {
                        console.log(contract.address, "is not a proxy");
                    }
                }

                const responseStr = await get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${addressForABI}&apikey=${apiKey}`);
                const response: Response<string> = JSON.parse(responseStr);
                const abi:ABIFunction[] = JSON.parse(response.result);
                console.log(abi);
            }

            if (!contract.selectors)
            {
                contract.selectors = new Set<string>();
            }

            contract.functions.forEach((func) =>
            {
                contract.selectors!.add(keccak256(func.replace(/ /g, "")).toString("hex").substring(0, 8));
            });
        }

        // TODO if it's only wanting contract creation could optimise the etherscan call
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