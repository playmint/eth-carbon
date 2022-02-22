import * as https from "https";

type Response<Type> = {
    status: string,
    message: string,
    result: Type
}

type Transaction = {
    input: string,
    gasUsed: number
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

export default async function()
{

    /*let provider = new ethers.providers.EtherscanProvider("homestead", "MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T");
    console.log(await provider.getBalance("0xfE4Aab053FED3cFbB7e5f6434e1585b4F17CC207"));

    let txns = await provider.getHistory("0x38065291fdce1a752afd725e96ff75e1c38ad6aa");
    console.log(txns);*/

    // TODO paging
    const responseStr = await get("https://api.etherscan.io/api?module=account&action=txlist&address=0x38065291fdce1a752afd725e96ff75e1c38ad6aa&sort=asc&apikey=MYTE9PTHZD1R3HBSKZNTIM9BU34YEWZI5T");
    const response:Response<Transaction[]> = JSON.parse(responseStr);
    response.result = response.result.map((transaction: Transaction) => {
        transaction.gasUsed = parseInt(transaction.gasUsed as any);
        return transaction;
    });
    console.log(response.result);
}