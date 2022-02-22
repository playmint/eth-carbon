declare type Transaction = {
    input: string;
    gasUsed: number;
    isError: boolean;
    isContractCreation: boolean;
    selector: string;
};
export declare function getTransactions(): Promise<Transaction[]>;
export {};
//# sourceMappingURL=index.d.ts.map