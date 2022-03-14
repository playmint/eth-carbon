# eth-carbon
Example of passing an ABI straight from EthersJS
```ts
let contract = new ethers.Contract(...);
await getTransactionsForContract("<etherscan api key>", [{
	address:"<address>",
	functions: new Set<string>(["func1", "func2"]),
	abi: contract.interface.fragments as unknown as ABIFunction[]
	}
]
```