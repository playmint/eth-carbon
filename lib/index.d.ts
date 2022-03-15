declare type Transaction = {
    blockNumber: number;
    timeStamp: number;
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
export declare function estimateCO2(apiKey: string, contracts: ContractFilter[]): Promise<void>;
export {};
//# sourceMappingURL=index.d.ts.map