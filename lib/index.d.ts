declare type Transaction = {
    input: string;
    gasUsed: number;
    isError: boolean;
    selector: string;
};
export declare function getTransactionsForAddress(apiKey: string, address: string): Promise<Transaction[]>;
declare type ContractFilter = {
    address: string;
    shouldIncludeContractCreation: boolean;
    shouldIncludeFailedTransactions: boolean;
    selectors?: Set<string>;
    functions?: Set<string>;
};
export declare function getTransactionsForContracts(apiKey: string, contracts: ContractFilter[]): Promise<{
    [address: string]: Transaction[];
}>;
export {};
//# sourceMappingURL=index.d.ts.map