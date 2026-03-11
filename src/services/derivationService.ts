import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import { computeAddress } from '@ethersproject/transactions';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bitcoin from 'bitcoinjs-lib';
import { TronWeb } from 'tronweb';
import { Account } from '@aptos-labs/ts-sdk';

const bip32 = BIP32Factory(ecc);

export interface DerivedWallet {
    address: string;
    privateKey: string;
    publicKey: string;
}

export const CHAIN_PATHS = {
    BTC: "m/84'/0'/0'/0/0",
    ETH: "m/44'/60'/0'/0/0",
    BNB: "m/44'/60'/0'/0/0",
    BASE: "m/44'/60'/0'/0/0",
    POLYGON: "m/44'/60'/0'/0/0",
    ARBITRUM: "m/44'/60'/0'/0/0",
    SOL: "m/44'/501'/0'/0'",
    SOL_USDT: "m/44'/501'/0'/0'",
    TRON: "m/44'/195'/0'/0/0",
    APTOS: "m/44'/637'/0'/0'/0'",
    DOGE: "m/44'/3'/0'/0/0",
    LTC: "m/84'/2'/0'/0/0",
    USDT_TRC20: "m/44'/195'/0'/0/0",
    USDT_BEP20: "m/44'/60'/0'/0/0",
    USDT_ERC20: "m/44'/60'/0'/0/0",
};

const DOGE_NETWORK = {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge',
    bip32: {
        public: 0x02facafd,
        private: 0x02fac398
    },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e
};

const LTC_NETWORK = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: {
        public: 0x019da462,
        private: 0x019d9cfe
    },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0
};

export const LEGACY_PATHS = {
    BTC: "m/44'/0'/0'/0/0",
    TRON: "m/44'/195'/0'/0/0"
};

type DerivationStrategy = (mnemonic: string) => Promise<DerivedWallet>;

const strategies: Record<string, DerivationStrategy> = {
    /**
     * ETH & BNB (EVM)
     */
    ETH: async (mnemonic) => {
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = (bip32 as any).fromSeed(seed);
        const child = root.derivePath(CHAIN_PATHS.ETH);
        if (!child.privateKey) throw new Error('Failed to derive EVM private key');

        const privateKey = '0x' + Buffer.from(child.privateKey).toString('hex');
        const address = computeAddress(privateKey);
        const publicKey = Buffer.from(child.publicKey).toString('hex');

        return { address, privateKey, publicKey };
    },
    BNB: async (mnemonic) => strategies.ETH(mnemonic),
    BASE: async (mnemonic) => strategies.ETH(mnemonic),
    POLYGON: async (mnemonic) => strategies.ETH(mnemonic),
    ARBITRUM: async (mnemonic) => strategies.ETH(mnemonic),
    USDT_TRC20: async (mnemonic) => strategies.TRON(mnemonic),
    USDT_BEP20: async (mnemonic) => strategies.ETH(mnemonic),
    USDT_ERC20: async (mnemonic) => strategies.ETH(mnemonic),

    /**
     * SOLANA
     */
    SOL: async (mnemonic) => {
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const derived = derivePath(CHAIN_PATHS.SOL, seed.toString('hex')).key;
        const keypair = Keypair.fromSeed(derived);
        return {
            address: keypair.publicKey.toBase58(),
            privateKey: Buffer.from(keypair.secretKey).toString('hex'),
            publicKey: keypair.publicKey.toBase58(),
        };
    },
    SOL_USDT: async (mnemonic) => strategies.SOL(mnemonic),

    /**
     * BITCOIN (SegWit)
     */
    BTC: async (mnemonic) => {
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = (bip32 as any).fromSeed(seed);
        const child = root.derivePath(CHAIN_PATHS.BTC);

        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.bitcoin
        });

        if (!address) throw new Error('Failed to derive BTC address');

        return {
            address,
            privateKey: child.toWIF(),
            publicKey: child.publicKey.toString('hex')
        };
    },

    /**
     * TRON
     */
    TRON: async (mnemonic) => {
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = (bip32 as any).fromSeed(seed);
        const child = root.derivePath(CHAIN_PATHS.TRON);
        const privateKeyHex = Buffer.from(child.privateKey).toString('hex');

        // TronWeb 6.x fix: Use robust derivation
        // @ts-ignore
        const address = TronWeb.address.fromPrivateKey(privateKeyHex);
        if (!address) throw new Error('Failed to derive TRON address');

        return {
            address,
            privateKey: privateKeyHex,
            publicKey: ''
        };
    },

    /**
     * APTOS
     */
    APTOS: async (mnemonic) => {
        // Aptos uses BIP44 m/44'/637'/0'/0'/0' typically
        const account = Account.fromDerivationPath({
            mnemonic,
            path: CHAIN_PATHS.APTOS as any
        });

        return {
            address: account.accountAddress.toString(),
            privateKey: account.privateKey.toString(),
            publicKey: account.publicKey.toString()
        };
    },
    DOGE: async (mnemonic) => {
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = (bip32 as any).fromSeed(seed);
        const child = root.derivePath(CHAIN_PATHS.DOGE);

        const { address } = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: DOGE_NETWORK
        });

        if (!address) throw new Error('Failed to derive DOGE address');

        return {
            address,
            privateKey: child.toWIF(),
            publicKey: child.publicKey.toString('hex')
        };
    },
    LTC: async (mnemonic) => {
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const root = (bip32 as any).fromSeed(seed);
        const child = root.derivePath(CHAIN_PATHS.LTC);

        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: LTC_NETWORK
        });

        if (!address) throw new Error('Failed to derive LTC address');

        return {
            address,
            privateKey: child.toWIF(),
            publicKey: child.publicKey.toString('hex')
        };
    },
};

export async function deriveWallet(mnemonic: string, chain: keyof typeof CHAIN_PATHS): Promise<DerivedWallet> {

    const strategy = strategies[chain];
    if (!strategy) {
        throw new Error(`Derivation strategy for ${chain} not found`);
    }

    const result = await strategy(mnemonic);

    return result;
}

export async function deriveAllWallets(mnemonic: string): Promise<Record<string, DerivedWallet>> {

    if (!bip39.validateMnemonic(mnemonic)) {
        console.error('[Derivation] Invalid Mnemonic Phrase!');
        throw new Error('Invalid Mnemonic Phrase. Please check your words.');
    }
    const results: Record<string, DerivedWallet> = {};
    const chains = Object.keys(CHAIN_PATHS) as (keyof typeof CHAIN_PATHS)[];

    for (const chain of chains) {
        try {
            results[chain] = await deriveWallet(mnemonic, chain);
        } catch (e) {
            console.warn(`[Derivation] Failed for ${chain}:`, e);
        }
    }

    return results;
}

/**
 * Scalable Registration for future chains
 */
export function registerChain(name: string, path: string, strategy: DerivationStrategy) {
    (CHAIN_PATHS as any)[name] = path;
    strategies[name] = strategy;
}
