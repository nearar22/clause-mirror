import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createTransactionKit } from "@genlayer/transaction-kit";
import { GenLayerTransactionPanel } from "@genlayer/transaction-kit-react";
import { ArrowLeftRight, BookOpenText, Check, ExternalLink, FileSearch, Fingerprint, Languages, LoaderCircle, LockKeyhole, PenLine, RefreshCw, Scale, ShieldCheck, Wallet, X } from "lucide-react";
import { clean, nextActions, shortAddress, tone } from "./model.mjs";
import "./styles.css";

const ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const RPC = import.meta.env.VITE_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const CHAIN_ID = Number(import.meta.env.VITE_GENLAYER_CHAIN_ID || "61997");
const CHAIN = { ...studioDevnet, id: CHAIN_ID, name: "GenLayer Studio Next", rpcUrls: { default: { http: [RPC] } } };
const EXPLORER = "https://explorer-studio-dev.genlayer.com";
const DEMO = {
  id: "supply-terms-demo", title: "Supply terms · EN / FR", status: "ASSESSED", revision: 0,
  source_language: "English", target_language: "French", owner: "0x1111111111111111111111111111111111111111", reviewer: "0x2222222222222222222222222222222222222222",
  source: { host: "example.org", url: "https://example.org/agreement-en" }, target: { host: "example.org", url: "https://example.org/agreement-fr" },
  assessment: { overall: "REVIEW", findings: [
    { index: 0, classification: "ALIGNED", source_quote: "The Supplier must notify the Buyer within five business days.", target_quote: "Le Fournisseur doit notifier l’Acheteur dans les cinq jours ouvrables.", explanation: "The duty and deadline are preserved." },
    { index: 1, classification: "AMBIGUOUS", source_quote: "Liability is capped at EUR 50,000 except in cases of fraud.", target_quote: "La responsabilité est plafonnée à 50 000 EUR.", explanation: "The fraud exception is not explicit in this target passage." }
  ], document_receipts: [{ index: 0, role: "source", host: "example.org", sha256: "da8ec72a4f09b568f615d337c046e5538f6ed204e8751c67d8c07d3f491f74be" }, { index: 1, role: "target", host: "example.org", sha256: "6c1f11d3953b2a16b0ff69f87a27ffca9b569a86b08b74f512c3daceb2c13e44" }] }
};

function App() {
  const [id, setId] = useState("clause-demo-mv1hkca2");
  const [title, setTitle] = useState("Cross-border supply agreement");
  const [purpose, setPurpose] = useState("Verify that the French translation preserves material obligations, exceptions, deadlines, and remedies before independent approval.");
  const [sourceLanguage, setSourceLanguage] = useState("English");
  const [targetLanguage, setTargetLanguage] = useState("French");
  const [sourceUrl, setSourceUrl] = useState("https://example.org/agreement-en");
  const [targetUrl, setTargetUrl] = useState("https://example.org/agreement-fr");
  const [reviewer, setReviewer] = useState("0x2222222222222222222222222222222222222222");
  const [replacement, setReplacement] = useState("https://example.org/agreement-fr-v2");
  const [note, setNote] = useState("Restore the omitted exception and publish a corrected translation for a new validator pass.");
  const [record, setRecord] = useState(DEMO);
  const [wallet, setWallet] = useState("");
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const client = useMemo(() => createClient({ chain: CHAIN }), []);
  const kit = useMemo(() => wallet && window.ethereum ? createTransactionKit({ chain: CHAIN, provider: window.ethereum, account: wallet }) : null, [wallet]);

  const load = useCallback(async () => {
    if (!ADDRESS || !id.trim()) return;
    setLoading(true);
    try { setRecord(clean(await client.readContract({ address: ADDRESS, functionName: "get_dossier", args: [id.trim()], jsonSafeReturn: true }))); setNotice(""); }
    catch { setNotice("No dossier was found for this ID. The sample desk stays visible until a live record is loaded."); }
    finally { setLoading(false); }
  }, [client, id]);
  useEffect(() => { if (ADDRESS) void load(); }, [load]);

  async function connect() {
    if (!window.ethereum) { setNotice("Install a browser wallet to write. Public dossiers remain readable without one."); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = `0x${CHAIN_ID.toString(16)}`;
      try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] }); }
      catch (error) { if (error?.code !== 4902) throw error; await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId, chainName: "GenLayer Studio Next", rpcUrls: [RPC], nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 } }] }); }
      setWallet(accounts[0]); setNotice("");
    } catch (error) { setNotice(error?.message || "Wallet connection did not complete."); }
  }

  const tx = useMemo(() => {
    if (!ADDRESS || !action) return null;
    const base = { kind: "write", address: ADDRESS };
    if (action === "create") return { ...base, method: "create_dossier", args: [id.trim(), title.trim(), purpose.trim(), sourceLanguage.trim(), targetLanguage.trim(), sourceUrl.trim(), targetUrl.trim(), reviewer.trim()] };
    if (action === "assess") return { ...base, method: "assess", args: [id.trim()] };
    if (action === "revision") return { ...base, method: "request_revision", args: [id.trim(), note.trim()] };
    if (action === "replace") return { ...base, method: "replace_translation", args: [id.trim(), replacement.trim()] };
    return { ...base, method: "finalize", args: [id.trim()] };
  }, [action, id, title, purpose, sourceLanguage, targetLanguage, sourceUrl, targetUrl, reviewer, note, replacement]);
  function write(next) { if (!ADDRESS) { setNotice("Deploy the contract and set VITE_CONTRACT_ADDRESS before sending writes."); return; } if (!kit) { setNotice("Connect a Studio Next wallet first."); return; } setAction(next); }
  function done(status) { if (status.phase === "finalized") { setAction(null); if (status.successful) void load(); else setNotice(`Transaction failed: ${status.executionResultName || status.statusName || "contract rejected the input"}.`); } }
  const findings = record?.assessment?.findings || [];
  const actions = nextActions(record, wallet);

  return <div className="site">
    <nav><a className="wordmark" href="#top"><span>CM</span><b>ClauseMirror</b></a><div className="network"><i/> STUDIO NEXT · {CHAIN_ID}</div><button className="wallet" onClick={connect}><Wallet size={15}/>{wallet ? shortAddress(wallet) : "Connect wallet"}</button></nav>
    <main id="top">
      <section className="intro"><p className="kicker"><Languages size={15}/> BILINGUAL EVIDENCE DESK</p><h1>Read both versions.<br/><em>Trust neither one alone.</em></h1><p className="lede">A validator-audited comparison for agreements where one softened verb, missing exception, or changed number can alter the deal.</p><div className="intro-notes"><span><b>01</b> Freeze both documents</span><span><b>02</b> Bind exact passages</span><span><b>03</b> Independent sign-off</span></div></section>

      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")}><X size={15}/></button></div>}

      <section className="desk">
        <aside className="folio left-folio">
          <div className="folio-head"><span>NEW DOSSIER</span><PenLine size={17}/></div>
          <label><span>DOSSIER ID</span><input value={id} onChange={e => setId(e.target.value)} /></label>
          <label><span>TITLE</span><input value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label><span>PURPOSE</span><textarea rows="4" value={purpose} onChange={e => setPurpose(e.target.value)} /></label>
          <div className="language-pair"><label><span>ORIGINAL</span><input value={sourceLanguage} onChange={e => setSourceLanguage(e.target.value)} /></label><ArrowLeftRight/><label><span>TRANSLATION</span><input value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)} /></label></div>
          <label><span>SOURCE DOCUMENT URL</span><input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} /></label>
          <label><span>TRANSLATED DOCUMENT URL</span><input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} /></label>
          <label><span>INDEPENDENT REVIEWER</span><input value={reviewer} onChange={e => setReviewer(e.target.value)} /></label>
          <button className="primary" onClick={() => write("create")}><BookOpenText size={16}/> Open evidence dossier</button>
        </aside>

        <section className="folio comparison">
          <header className="record-head"><div><p>DOSSIER / {record?.id || "—"}</p><h2>{record?.title || "Load a dossier"}</h2></div><span className={`seal ${tone(record?.assessment?.overall || record?.status)}`}>{record?.assessment?.overall || record?.status || "EMPTY"}</span></header>
          <div className="load-line"><input value={id} onChange={e => setId(e.target.value)} /><button onClick={() => void load()}>{loading ? <LoaderCircle className="spin" size={16}/> : <FileSearch size={16}/>} Load</button></div>
          <div className="documents"><a href={record?.source?.url} target="_blank"><small>ORIGINAL · {record?.source_language}</small><b>{record?.source?.host}</b><ExternalLink size={13}/></a><div className="mirror-mark"><ArrowLeftRight size={18}/><span>SEMANTIC<br/>MIRROR</span></div><a href={record?.target?.url} target="_blank"><small>TRANSLATION · {record?.target_language}</small><b>{record?.target?.host}</b><ExternalLink size={13}/></a></div>
          <div className="ruling-line"><span>{findings.length} MATERIAL FINDING{findings.length === 1 ? "" : "S"}</span><span>REVISION {record?.revision || 0} / 2</span></div>
          <div className="findings">{findings.length ? findings.map(item => <article key={item.index} className={item.classification.toLowerCase()}><div className="index">{String(item.index + 1).padStart(2, "0")}</div><div className="passages"><p><span>{record.source_language}</span>“{item.source_quote}”</p><div className="stitch"/><p><span>{record.target_language}</span>{item.target_quote ? `“${item.target_quote}”` : <i>No target passage found</i>}</p></div><div className="finding-note"><b>{item.classification}</b><p>{item.explanation}</p></div></article>) : <div className="empty"><Scale size={32}/><b>No comparison recorded</b><p>Assessing freezes both pages before validators compare their material meaning.</p></div>}</div>
          {record?.assessment?.document_receipts?.length > 0 && <div className="receipts">{record.assessment.document_receipts.map(item => <div key={item.index}><Fingerprint size={14}/><span>{item.role.toUpperCase()} · {item.host}</span><code>{item.sha256.slice(0, 12)}…{item.sha256.slice(-8)}</code></div>)}</div>}
          <div className="actions">
            {record?.status === "READY" && <button onClick={() => write("assess")}><RefreshCw size={15}/> Run validator audit</button>}
            {actions.includes("revision") && <div className="inline-action"><input value={note} onChange={e => setNote(e.target.value)} /><button onClick={() => write("revision")}>Request revision</button></div>}
            {record?.status === "REVISION_REQUESTED" && <div className="inline-action"><input value={replacement} onChange={e => setReplacement(e.target.value)} /><button onClick={() => write("replace")}>Publish replacement</button></div>}
            {actions.includes("finalize") && <button className="finalize" onClick={() => write("finalize")}><Check size={15}/> Reviewer final sign-off</button>}
          </div>
        </section>
      </section>

      <section className="boundary"><LockKeyhole/><div><b>The boundary is explicit.</b><p>ClauseMirror records a semantic evidence audit. It does not certify a translator, establish governing law, or replace professional legal review.</p></div><ShieldCheck/></section>
    </main>
    <footer><span>CLAUSEMIRROR / EVIDENCE BEFORE EQUIVALENCE</span>{ADDRESS ? <a href={`${EXPLORER}/address/${ADDRESS}`} target="_blank">CONTRACT {shortAddress(ADDRESS)} <ExternalLink size={12}/></a> : <span className="not-live">CONTRACT NOT DEPLOYED</span>}</footer>
    {action && kit && tx && <div className="tx-cover"><div className="tx-sheet"><div className="tx-head"><span>GENLAYER CONSENSUS</span><button onClick={() => setAction(null)}><X size={16}/></button></div><GenLayerTransactionPanel kit={kit} tx={tx} network="GenLayer Studio Next" theme="light" trackUntil="finalized" onDone={done}/></div></div>}
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
