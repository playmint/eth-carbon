declare type Transaction = {
    blockNumber: number;
    input: string;
    gasUsed: number;
    isError: boolean;
    selector: string;
};
declare type ABIField = {
    name: string;
    type: string;
    components?: ABIField[];
};
export declare type ABIFunction = {
    type: "function" | "constructor" | "receive" | "fallback";
    name: string;
    inputs: ABIField[];
    outputs?: ABIField[];
    stateMutability: "pure" | "view" | "payable" | "nonpayable";
};
export declare function getTransactionsForAddress(apiKey: string, address: string): Promise<Transaction[]>;
declare type ContractFilter = {
    address: string;
    shouldIncludeContractCreation?: boolean;
    shouldIncludeFailedTransactions?: boolean;
    selectors?: Set<string>;
    functions?: Set<string>;
    abi?: string | readonly ABIFunction[];
};
export declare function getTransactionsForContracts(apiKey: string, contracts: ContractFilter[]): Promise<{
    [address: string]: Transaction[];
}>;
export {};
//# sourceMappingURL=index.d.ts.map