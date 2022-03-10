import * as https from "https";
import keccak256 from "keccak256";

type Response<Type> = {
    status: string,
    message: string,
    result: Type
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
    shouldIncludeContractCreation: boolean,
    shouldIncludeFailedTransactions: boolean,
    selectors?: Set<string>,
    functions?: Set<string>
};

export async function getTransactionsForContracts(apiKey: string, contracts: ContractFilter[]): Promise<{[address: string]: Transaction[]}>
{
    let result: {[address: string]: Transaction[]} = {};

    for (let i = 0; i < contracts.length; ++i)
    {
        const contract = contracts[i];

        if (contract.functions)
        {
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