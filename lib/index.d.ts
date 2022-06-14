export declare type Transaction = {
    hash: string;
    blockNumber: number;
    timeStamp: number;
    input: string;
    gasUsed: bigint;
    isError: boolean;
    selector: string;
};
export declare type ABIField = {
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
export declare type ContractFilter = {
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
export declare type EmissionsEstimate = {
    gas: bigint;
    lower: number;
    best: number;
    upper: number;
};
export declare type EmissionsReport = {
    total: EmissionsEstimate;
    byAddress: {
        [address: string]: EmissionsReportForAddress;
    };
    byDate: Map<Date, EmissionsEstimate>;
};
export declare type EmissionsReportForAddress = {
    total: EmissionsEstimate;
    byDate: Map<Date, EmissionsReportForAddressAndDate>;
    bySelector: {
        [selector: string]: EmissionsEstimate;
    };
};
export declare type EmissionsReportForAddressAndDate = {
    total: EmissionsEstimate;
    bySelector: {
        [selector: string]: EmissionsEstimate;
    };
};
export declare function estimateCO2(apiKey: string, contracts: ContractFilter[]): Promise<EmissionsReport>;
//# sourceMappingURL=index.d.ts.map