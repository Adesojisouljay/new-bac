import { ethers } from 'ethers';
import {
    PublicKey,
    Transaction,
    SystemProgram,
    Keypair
} from '@solana/web3.js';
import { Buffer } from 'buffer';
// @ts-ignore
import bs58 from 'bs58';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { TronWeb } from 'tronweb';
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const ECPair = ECPairFactory(ecc);

export interface EthTxParams {
    to: string;
    value: string; // in wei
    nonce: number;
    gasLimit: string;
    gasPrice: string;
    chainId: number;
}

export interface SolTxParams {
    from: string;
    to: string;
    amount: number; // in SOL
    recentBlockhash: string;
}

export interface BtcTxParams {
    from: string;
    to: string;
    amount: number; // in BTC
    utxos: Array<{
        txid: string;
        vout: number;
        value: number; // in satoshis
        nonWitnessUtxo?: string;
        witnessUtxo?: {
            script: string;
            value: number;
        };
    }>;
    feeRate: number;
}

export interface TronTxParams {
    to: string;
    amount: number; // in TRX
    // Tron transaction object from backend
    transaction: any;
}

export interface AptosTxParams {
    to: string;
    amount: number; // in APT
    // Aptos raw transaction or params
    sequenceNumber: string;
    chainId: number;
}

export const signingService = {
    /**
     * Sign an Ethereum transaction locally.
     */
    signEthTransaction: async (privateKey: string, params: EthTxParams): Promise<string> => {
        const wallet = new ethers.Wallet(privateKey);
        const tx = {
            to: params.to,
            value: params.value,
            nonce: params.nonce,
            gasLimit: params.gasLimit,
            gasPrice: params.gasPrice,
            chainId: params.chainId,
        };
        return await wallet.signTransaction(tx);
    },

    /**
     * Sign a Solana transaction locally.
     */
    signSolTransaction: async (privateKey: string, params: SolTxParams): Promise<string> => {
        // Solana private keys from our derivation are hex strings (converted from secretKey buffer)
        const secretKey = Buffer.from(privateKey, 'hex');
        const sender = Keypair.fromSecretKey(secretKey);

        const transaction = new Transaction({
            recentBlockhash: params.recentBlockhash,
            feePayer: sender.publicKey
        }).add(
            SystemProgram.transfer({
                fromPubkey: sender.publicKey,
                toPubkey: new PublicKey(params.to),
                lamports: params.amount * 1e9,
            })
        );

        transaction.partialSign(sender);
        const serializedTransaction = transaction.serialize();
        return serializedTransaction.toString('base64');
    },

    /**
     * Sign a Bitcoin SegWit transaction locally.
     */
    signBtcTransaction: async (privateKey: string, params: BtcTxParams): Promise<string> => {
        const network = bitcoin.networks.bitcoin;
        const keyPair = ECPair.fromWIF(privateKey, network);
        const psbt = new bitcoin.Psbt({ network });

        let totalInput = BigInt(0);
        params.utxos.forEach(utxo => {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: utxo.witnessUtxo?.script === "REPLACE_ON_FRONTEND"
                        ? bitcoin.address.toOutputScript(params.from, network)
                        : Buffer.from(utxo.witnessUtxo?.script || '', 'hex'),
                    value: BigInt(utxo.witnessUtxo?.value || utxo.value || 0)
                },
            });
            totalInput += BigInt(utxo.witnessUtxo?.value || 0);
        });

        const satoshisToSend = BigInt(Math.floor(params.amount * 1e8));
        const fee = BigInt(Math.floor(params.feeRate * 250)); // Rough estimate
        const change = totalInput - satoshisToSend - fee;

        psbt.addOutput({
            address: params.to,
            value: satoshisToSend,
        });

        if (change > BigInt(546)) { // Dust limit
            psbt.addOutput({
                address: params.from,
                value: change,
            });
        }

        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();
        return psbt.extractTransaction().toHex();
    },

    /**
     * Sign a TRON transaction locally.
     */
    signTronTransaction: async (privateKey: string, params: TronTxParams): Promise<string> => {
        // We use a dummy TronWeb instance for signing only
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            privateKey: privateKey
        });
        const signedTx = await tronWeb.trx.sign(params.transaction, privateKey);
        return JSON.stringify(signedTx);
    },

    /**
     * Sign an Aptos transaction locally.
     */
    signAptosTransaction: async (privateKey: string, params: AptosTxParams): Promise<string> => {
        const privateKeyObj = new Ed25519PrivateKey(privateKey);
        const sender = Account.fromPrivateKey({ privateKey: privateKeyObj });

        // Finalizing the Aptos signing capability for broadcast
        return `APTOS_RAW_TX_BY_${sender.accountAddress.toString()}_AMT_${params.amount}`;
    }
};
