'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState(null);
  const [rows, setRows] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (file) => {
    setError(null);
    setResult(null);
    if (!file) {
      setFileName(null);
      setRows(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const list = Array.isArray(parsed) ? parsed : parsed.rows;
        if (!Array.isArray(list)) throw new Error('O arquivo não tem uma lista de linhas.');
        setRows(list);
      } catch (err) {
        setError(`Arquivo inválido: ${err.message}`);
        setRows(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rows) {
      setError('Escolha um arquivo .json válido primeiro.');
      return;
    }
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, rows }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Erro ao enviar.');
      else setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="wrap">
      <div className="masthead" style={{ marginBottom: 22 }}>
        <div className="masthead-left">
          <img className="crest" src="/crest.png" alt="Brasão" />
          <div>
            <h1>Atualizar folha</h1>
            <div className="sub">Suba o arquivo .json que o Claude gerou no chat</div>
          </div>
        </div>
        <a href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
          ← Ver painel
        </a>
      </div>

      <form className="upload-card" onSubmit={handleSubmit}>
        <h2>Como funciona</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: -8, lineHeight: 1.6 }}>
          Todo mês, mande os PDFs de Encargos e de Centro de Custo (das 3 entidades) para o Claude, como
          sempre fez. No final, peça pra ele gerar o arquivo <code>.json</code> de atualização — ele te dá
          um arquivo pra baixar. Escolha esse arquivo aqui embaixo e clique em enviar. Não tem IA rodando
          no site, então não tem custo nenhum de API — só grava os números no banco.
        </p>

        <div className="file-row" style={{ marginTop: 18 }}>
          <label>Arquivo de atualização (.json)</label>
          <input type="file" accept="application/json" onChange={(e) => handleFile(e.target.files[0])} />
        </div>

        {rows && (
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>
            {fileName}: {rows.length} linha(s) reconhecida(s).
          </div>
        )}

        <div className="file-row">
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha de upload" required />
        </div>

        <button type="submit" className="btn" disabled={sending || !rows}>
          {sending ? 'Gravando…' : 'Atualizar painel'}
        </button>

        {result && (
          <div className="msg msg-ok">
            Gravado com sucesso: {result.linhas} linha(s), período(s) {result.periodos.join(', ')}.{' '}
            <a href="/" style={{ color: 'inherit', fontWeight: 700 }}>
              Ver painel atualizado →
            </a>
          </div>
        )}
        {error && <div className="msg msg-error">{error}</div>}
      </form>
    </div>
  );
}
