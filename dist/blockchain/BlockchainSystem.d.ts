/**
 * Blockchain Integration and Smart Contracts
 * Blockchain interaction, smart contract deployment, transaction management, and crypto operations
 */
export interface Blockchain {
    id: string;
    name: string;
    network: BlockchainNetwork;
    chainId: number;
    rpcUrl: string;
    explorer: string;
    nativeCurrency: Currency;
    status: BlockchainStatus;
}
export declare enum BlockchainNetwork {
    Ethereum = "ethereum",
    Polygon = "polygon",
    BSC = "bsc",
    Avalanche = "avalanche",
    Arbitrum = "arbitrum",
    Optimism = "optimism",
    Solana = "solana",
    Custom = "custom"
}
export declare enum BlockchainStatus {
    Connected = "connected",
    Disconnected = "disconnected",
    Syncing = "syncing",
    Error = "error"
}
export interface Currency {
    symbol: string;
    name: string;
    decimals: number;
}
export interface Wallet {
    id: string;
    address: string;
    type: WalletType;
    balance: string;
    tokens: Token[];
    transactions: Transaction[];
    createdAt: Date;
}
export declare enum WalletType {
    EOA = "eoa",// Externally Owned Account
    Contract = "contract",
    MultiSig = "multisig"
}
export interface Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;
    price?: number;
}
export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    data?: string;
    gasPrice: string;
    gasLimit: string;
    nonce: number;
    status: TransactionStatus;
    blockNumber?: number;
    timestamp?: Date;
    receipt?: TransactionReceipt;
}
export declare enum TransactionStatus {
    Pending = "pending",
    Confirmed = "confirmed",
    Failed = "failed",
    Dropped = "dropped"
}
export interface TransactionReceipt {
    transactionHash: string;
    blockNumber: number;
    blockHash: string;
    gasUsed: string;
    cumulativeGasUsed: string;
    logs: Log[];
    status: boolean;
}
export interface Log {
    address: string;
    topics: string[];
    data: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
}
export interface SmartContract {
    id: string;
    name: string;
    address: string;
    abi: ContractABI;
    bytecode: string;
    sourceCode?: string;
    compiler: CompilerInfo;
    deployedAt: Date;
    blockchain: string;
    verified: boolean;
}
export interface ContractABI {
    functions: FunctionABI[];
    events: EventABI[];
    constructor?: ConstructorABI;
}
export interface FunctionABI {
    name: string;
    type: 'function' | 'view' | 'pure';
    inputs: Parameter[];
    outputs: Parameter[];
    stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
}
export interface EventABI {
    name: string;
    inputs: Parameter[];
    anonymous: boolean;
}
export interface ConstructorABI {
    inputs: Parameter[];
    stateMutability: 'nonpayable' | 'payable';
}
export interface Parameter {
    name: string;
    type: string;
    indexed?: boolean;
    components?: Parameter[];
}
export interface CompilerInfo {
    version: string;
    language: 'Solidity' | 'Vyper';
    settings: Record<string, any>;
}
export interface ContractCall {
    contract: string;
    function: string;
    args: any[];
    value?: string;
    gasLimit?: string;
}
export interface Block {
    number: number;
    hash: string;
    parentHash: string;
    timestamp: Date;
    transactions: string[];
    miner: string;
    difficulty: string;
    gasLimit: string;
    gasUsed: string;
}
export interface NFT {
    tokenId: string;
    contract: string;
    owner: string;
    metadata: NFTMetadata;
    uri: string;
}
export interface NFTMetadata {
    name: string;
    description: string;
    image: string;
    attributes: NFTAttribute[];
}
export interface NFTAttribute {
    trait_type: string;
    value: string | number;
}
export interface DeFiPosition {
    protocol: string;
    type: DeFiPositionType;
    tokens: TokenAmount[];
    value: string;
    apy?: number;
}
export declare enum DeFiPositionType {
    Lending = "lending",
    Borrowing = "borrowing",
    Staking = "staking",
    LiquidityProviding = "liquidity_providing"
}
export interface TokenAmount {
    token: Token;
    amount: string;
}
/**
 * Blockchain Manager
 */
export declare class BlockchainManager {
    private blockchains;
    private wallets;
    private contracts;
    private transactions;
    /**
     * Add blockchain
     */
    addBlockchain(blockchain: Omit<Blockchain, 'id' | 'status'>): Blockchain;
    /**
     * Connect to blockchain
     */
    connect(blockchainId: string): Promise<void>;
    /**
     * Create wallet
     */
    createWallet(blockchainId: string): Wallet;
    /**
     * Get balance
     */
    getBalance(address: string, blockchainId: string): Promise<string>;
    /**
     * Send transaction
     */
    sendTransaction(from: string, to: string, value: string, data?: string): Promise<Transaction>;
    /**
     * Deploy smart contract
     */
    deployContract(name: string, bytecode: string, abi: ContractABI, constructorArgs: any[] | undefined, from: string, blockchainId: string): Promise<SmartContract>;
    /**
     * Call contract function
     */
    callContract(call: ContractCall): Promise<any>;
    /**
     * Get transaction
     */
    getTransaction(hash: string): Transaction | undefined;
    /**
     * Get wallet
     */
    getWallet(id: string): Wallet | undefined;
    /**
     * Get contract
     */
    getContract(id: string): SmartContract | undefined;
    /**
     * List blockchains
     */
    listBlockchains(): Blockchain[];
    /**
     * Get block
     */
    getBlock(blockNumber: number, blockchainId: string): Promise<Block>;
    /**
     * Estimate gas
     */
    estimateGas(call: ContractCall): Promise<string>;
    private executeView;
    private executeTransaction;
    private generateAddress;
    private generateBlockchainId;
    private generateWalletId;
    private generateContractId;
    private generateTransactionHash;
    private generateContractAddress;
    private generateBlockHash;
}
/**
 * NFT Manager
 */
export declare class NFTManager {
    private nfts;
    /**
     * Mint NFT
     */
    mintNFT(contract: string, to: string, metadata: NFTMetadata, uri: string): Promise<NFT>;
    /**
     * Transfer NFT
     */
    transferNFT(contract: string, tokenId: string, from: string, to: string): Promise<void>;
    /**
     * Get NFT
     */
    getNFT(contract: string, tokenId: string): NFT | undefined;
    /**
     * Get NFTs by owner
     */
    getNFTsByOwner(owner: string): NFT[];
    /**
     * Get collection
     */
    getCollection(contract: string): NFT[];
    private generateTokenId;
}
/**
 * DeFi Manager
 */
export declare class DeFiManager {
    private positions;
    /**
     * Add position
     */
    addPosition(wallet: string, position: DeFiPosition): void;
    /**
     * Get positions
     */
    getPositions(wallet: string): DeFiPosition[];
    /**
     * Calculate total value
     */
    calculateTotalValue(wallet: string): string;
    /**
     * Get yield
     */
    calculateYield(wallet: string): number;
}
/**
 * Token Swap Manager
 */
export declare class TokenSwapManager {
    /**
     * Get swap quote
     */
    getQuote(tokenIn: string, tokenOut: string, amountIn: string, blockchain: string): Promise<SwapQuote>;
    /**
     * Execute swap
     */
    executeSwap(from: string, tokenIn: string, tokenOut: string, amountIn: string, minAmountOut: string, blockchain: string): Promise<Transaction>;
}
export interface SwapQuote {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    price: string;
    priceImpact: number;
    route: string[];
    gas: string;
}
/**
 * Singleton instances
 */
export declare const blockchainManager: BlockchainManager;
export declare const nftManager: NFTManager;
export declare const defiManager: DeFiManager;
export declare const tokenSwapManager: TokenSwapManager;
//# sourceMappingURL=BlockchainSystem.d.ts.map