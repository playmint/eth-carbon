import * as https from "https";

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
    isContractCreation: boolean,
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

export async function getTransactions()
{
    // TODO paging
    const responseStr = await get("https://api.etherscan.io/api?module=account&action=txlist&address=0x938034c188c7671cabdb80d19cd31b71439516a9&sort=asc&apikey=MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T");
    const response: Response<RawTransaction[]> = JSON.parse(responseStr);
    const transactions: Transaction[] = response.result.map((transaction: RawTransaction) => {
        return {
            input: transaction.input,
            gasUsed: parseInt(transaction.gasUsed),
            isError: transaction.isError == "1",
            isContractCreation: transaction.input.substring(10, 66) != "00000000000000000000000000000000000000000000000000000000",  // if it's a function call the first word will be the 4 byte selector followed by zeroes, if it's a contract creation then all 32 bytes will be used
            selector: transaction.input.substring(2, 10)
        };
    });
    
    return transactions;
}