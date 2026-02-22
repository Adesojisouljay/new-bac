import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import { computeAddress } from '@ethersproject/transactions';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bitcoin from 'bitcoinjs-lib';
import TronWeb from 'tronweb';
import { Account } from '@aptos-labs/ts-sdk';

const bip32 = BIP32Factory(ecc);

export interface DerivedWallet {
    address: string;
    privateKey: string;
    publicKey: string;
}

export const CHAIN_PATHS = {
    BTC: "m/44'/0'/0'/0/0",
    ETH: "m/44'/60'/0'/0/0",
    BNB: "m/44'/60'/0'/0/0",
    BASE: "m/44'/60'/0'/0/0",
    POLYGON: "m/44'/60'/0'/0/0",
    ARBITRUM: "m/44'/60'/0'/0/0",
    SOL: "m/44'/501'/0'/0'",
    TRON: "m/44'/195'/0'/0'",
    APTOS: "m/44'/637'/0'/0'/0'",
    USDT_TRC20: "m/44'/195'/0'/0'",
    USDT_BEP20: "m/44'/60'/0'/0/0",
    USDT_ERC20: "m/44'/60'/0'/0/0",
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
        const derived = derivePath(CHAIN_PATHS.TRON, seed.toString('hex')).key;
        const privateKeyHex = derived.toString('hex');

        // @ts-ignore
        const address = TronWeb.utils?.address?.fromPrivateKey(privateKeyHex);
        if (!address) throw new Error('Failed to derive TRON address');

        return {
            address,
            privateKey: privateKeyHex,
            publicKey: '' // TronWeb doesn't easily expose raw pubkey in a simple call, but address is sufficient
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
    }
};

export async function deriveWallet(mnemonic: string, chain: keyof typeof CHAIN_PATHS): Promise<DerivedWallet> {
    console.log(`[Derivation] Starting for ${chain}...`);
    const strategy = strategies[chain];
    if (!strategy) {
        throw new Error(`Derivation strategy for ${chain} not found`);
    }
    const result = await strategy(mnemonic);
    console.log(`[Derivation] Success for ${chain}. Address: ${result.address}`);
    return result;
}

export async function deriveAllWallets(mnemonic: string): Promise<Record<string, DerivedWallet>> {
    console.log('[Derivation] Validating mnemonic length:', mnemonic.split(/\s+/).length);
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
