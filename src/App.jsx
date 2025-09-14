import React from 'react';
import WalletLogin from './components/WalletLogin';

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>连接钱包（GitHub-only） — 版本 0.01</h1>
        <p className="muted">支持 MetaMask 与 WalletConnect。将代码托管到 GitHub 并使用 GitHub Pages 发布。</p>
      </header>

      <main>
        <WalletLogin />
      </main>

      <footer>
        <small>Repo: push to GitHub only · Version 0.01</small>
      </footer>
    </div>
  );
}
