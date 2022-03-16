# eth-carbon
Small library to estimate the CO2 emissions that Ethereum smart contracts are responsible for.

## Installation
`npm install @playmint/eth-carbon`

## API
```ts
async function estimateCO2(etherscanApiKey: string, contracts: ContractFilter[]): Promise<EmissionsReport>

type EmissionsEstimate = {
	lower: number,	// lower bound
	best: number,	// best guess
	upper: number	// upper bound
};

type EmissionsReport = {
	dailyEmissions: Map<Date, EmissionsEstimate>,
	total: EmissionsEstimate
}

type ContractFilter = {
	// contract address
	address: string,
	// include the contract creation transaction, defaults to true
	shouldIncludeContractCreation?: boolean,
	// include failed transactions, default is false
	shouldIncludeFailedTransactions?: boolean,
	// 4 byte function selectors to include, if both 'selectors' and 'functions' 
	// are undefined, then all transactions will be included
	selectors?: Set<string>,
	// can include either function names or signatures, or both. If any function
	// names are specified then the signature will be looked up from the ABI. If
	// multiple functions have the same name then this will fail.
	functions?: Set<string>,
	// this is only needed if any functions are specified just as a function name
	// and not the full function signature. If an ABI is needed but none is given,
	// then an attempt will be made to get the ABI from etherscan, if the contract
	// isn't verified on etherscan then this step will fail. This can be a json
	// string, or an array of objects fitting the ABIFunction type (e.g.
	// ethers.utils.Interface.fragments)
	abi?: string | readonly  ABIFunction[]
};

type ABIField = {
	name: string,
	type: string,
	components?: ABIField[]
};

type ABIFunction = {
	type: "function" | "constructor" | "receive" | "fallback",
	name: string,
	inputs: ABIField[],
	outputs?: ABIField[],
	stateMutability: "pure" | "view" | "payable" | "nonpayable"
};

async function getTransactionsForContracts(apiKey: string, contracts: ContractFilter[]): Promise<{[address: string]: Transaction[]}>

type Transaction = {
	blockNumber: number,
	timeStamp: number,
	input: string,
	gasUsed: number,
	isError: boolean,
	selector: string
};
```

## Examples
Standard emissions report
```ts
import {estimateCO2} from "@playmint/eth-carbon";

async function main() {
	const emissionsReport = await estimateCO2(
		"<etherscan API key>",
		[{address: "<contractAddress1>"}, {address: "<contractAddress2>"}]);

	emissionsReport.dailyEmissions.forEach((value, key) => {
		console.log(`${key}| lower:${value.lower}, best:${value.best}, upper:${value.upper}`);
	});

	console.log(`TOTAL| lower:${emissionsReport.total.lower}, best:${emissionsReport.total.best}, upper:${emissionsReport.total.upper}`);
}

main().catch((e) => {
	console.error(e);
}
```
Filtering by functions and selectors
```ts
const emissionsReport = await estimateCO2(
	"<etherscan API key>", [{
		address: "<contractAddress>",
		selectors: new Set<string>(["12345678", "9abcdef0"]),
		functions: new Set<string>(["func1", "func2", "func3(uint256,string)"])
	}]);
```
Passing ABI from EthersJS object
```ts
let contract = new ethers.Contract(...);
await getTransactionsForContract("<etherscan api key>", [{
	address:"<contractAddress>",
	functions:  new  Set<string>(["func1", "func2"]),
	abi:  contract.interface.fragments  as  unknown  as  ABIFunction[]
}]
```
## How it works
Contract transactions are divided into days, and their combined gas cost per day is calculated. Using daily network gas usage data from [https://etherscan.io/chart/gasused](https://etherscan.io/chart/gasused) it calculates the percentage of the daily gas used by the contract. Then using daily CO2 emissions estimates from [https://kylemcdonald.github.io/ethereum-emissions/](https://kylemcdonald.github.io/ethereum-emissions/) it uses the daily gas percentage to estimate emissions for that day. All of the emissions figures across all days can then be added together for a final total figure.  