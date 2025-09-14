import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WalletConnectProvider from "@walletconnect/web3-provider";
import Web3Modal from "web3modal";

/**
 * 版本 0.01
 * 简单的连接/断开逻辑：
 * - MetaMask: window.ethereum
 * - WalletConnect: @walletconnect/web3-provider
 *
 * 注意：真实线上环境请考虑更多错误边界处理、网络切换、链白名单等。
 */

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider,
    options: {
      // 这里使用公共 WalletConnect bridge（可换成你自己的）
      rpc: {
        1: "https://cloudflare-eth.com",
        3: "https://rpc.ankr.com/eth_ropsten",
        5: "https://rpc.ankr.com/eth_goerli"
      },
      bridge: "https://bridge.walletconnect.org",
      qrcode: true
    }
  }
};

let web3Modal; // single instance

function initWeb3Modal() {
  if (typeof window === 'undefined') return;
  if (!web3Modal) {
    web3Modal = new Web3Modal({
      cacheProvider: true,
      providerOptions
    });
  }
  return web3Modal;
}

export default function WalletLogin() {
  const [provider, setProvider] = useState(null); // raw provider
  const [ethProvider, setEthProvider] = useState(null); // ethers provider
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initWeb3Modal();
    // auto connect if cached
    if (web3Modal && web3Modal.cachedProvider) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      const modal = initWeb3Modal();
      const rawProvider = await modal.connect();
      // create ethers provider and signer
      const ethersProvider = new ethers.BrowserProvider(rawProvider);
      const signer = await ethersProvider.getSigner();
      const addr = await signer.getAddress();
      const network = await ethersProvider.getNetwork();

      // save
      setProvider(rawProvider);
      setEthProvider(ethersProvider);
      setSigner(signer);
      setAddress(addr);
      setChainId(network.chainId);

      // listen to accounts / chain changes
      if (rawProvider.on) {
        rawProvider.on("accountsChanged", (accounts) => {
          if (accounts.length === 0) {
            disconnect();
          } else {
            setAddress(accounts[0]);
          }
        });
        rawProvider.on("chainChanged", async (chain) => {
          // chain could be hex or decimal string
          try {
            const n = Number(chain);
            setChainId(n);
          } catch {
            setChainId(chain);
          }
        });
        rawProvider.on("disconnect", (code, reason) => {
          console.log("provider disconnect", code, reason);
          disconnect();
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setConnecting(false);
    }
  }

  async function connectMetaMask() {
    setError(null);
    setConnecting(true);
    try {
      if (!window.ethereum) throw new Error("未检测到 MetaMask（window.ethereum）。");
      const rawProvider = window.ethereum;
      await rawProvider.request({ method: "eth_requestAccounts" });
      const ethersProvider = new ethers.BrowserProvider(rawProvider);
      const signer = await ethersProvider.getSigner();
      const addr = await signer.getAddress();
      const network = await ethersProvider.getNetwork();

      setProvider(rawProvider);
      setEthProvider(ethersProvider);
      setSigner(signer);
      setAddress(addr);
      setChainId(network.chainId);

      // attach listeners if present
      rawProvider.on?.("accountsChanged", (accounts) => {
        if (accounts.length === 0) disconnect();
        else setAddress(accounts[0]);
      });
      rawProvider.on?.("chainChanged", (chain) => {
        try { setChainId(Number(chain)); } catch { setChainId(chain); }
      });
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setConnecting(false);
    }
  }

  async function connectWalletConnect() {
    setError(null);
    setConnecting(true);
    try {
      const WalletConnectProviderPkg = WalletConnectProvider;
      const wcProvider = new WalletConnectProviderPkg({
        rpc: providerOptions.walletconnect.options.rpc,
        bridge: providerOptions.walletconnect.options.bridge,
        qrcode: true
      });
      await wcProvider.enable();
      const ethersProvider = new ethers.BrowserProvider(wcProvider);
      const signer = await ethersProvider.getSigner();
      const addr = await signer.getAddress();
      const network = await ethersProvider.getNetwork();

      setProvider(wcProvider);
      setEthProvider(ethersProvider);
      setSigner(signer);
      setAddress(addr);
      setChainId(network.chainId);

      wcProvider.on?.("disconnect", (code, reason) => {
        console.log("wc disconnect", code, reason);
        disconnect();
      });
      wcProvider.on?.("accountsChanged", (accounts) => {
        if (accounts.length === 0) disconnect();
        else setAddress(accounts[0]);
      });
      wcProvider.on?.("chainChanged", (chain) => {
        try { setChainId(Number(chain)); } catch { setChainId(chain); }
      });
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setError(null);
    try {
      if (provider?.disconnect && typeof provider.disconnect === "function") {
        try { await provider.disconnect(); } catch {}
      }
      if (web3Modal && web3Modal.clearCachedProvider) {
        web3Modal.clearCachedProvider();
      }
    } catch (err) {
      console.warn("disconnect error", err);
    } finally {
      setProvider(null);
      setEthProvider(null);
      setSigner(null);
      setAddress(null);
      setChainId(null);
    }
  }

  async function signMessage() {
    try {
      if (!signer) throw new Error("未连接钱包");
      const message = `Login request @ ${new Date().toISOString()}`;
      const sig = await signer.signMessage(message);
      alert(`签名完成：\nmessage: ${message}\nsignature: ${sig}`);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  return (
    <div className="wallet-card">
      <div className="status-row">
        <div>
          <strong>地址：</strong> {address ?? <span className="muted">未连接</span>}
        </div>
        <div>
          <strong>链：</strong> {chainId ?? <span className="muted">未知</span>}
        </div>
      </div>

      <div className="controls">
        {!address ? (
          <>
            <button onClick={connectMetaMask} disabled={connecting} className="btn">
              连接 MetaMask
            </button>

            <button onClick={connectWalletConnect} disabled={connecting} className="btn outline">
              使用 WalletConnect
            </button>

            <button onClick={connect} disabled={connecting} className="btn ghost">
              通用弹窗（Web3Modal）
            </button>
          </>
        ) : (
          <>
            <button onClick={signMessage} className="btn">签名以登录</button>
            <button onClick={disconnect} className="btn danger">断开连接</button>
          </>
        )}
      </div>

      {connecting && <p className="muted">连接中…</p>}
      {error && <p className="error">错误：{error}</p>}

      <div className="help">
        <p className="muted small">提示：建议在开发时使用 Chrome + MetaMask。WalletConnect 可用于手机扫码。</p>
      </div>
    </div>
  );
}
