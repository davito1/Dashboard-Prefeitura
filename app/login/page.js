'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('E-mail ou senha incorretos.');
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="wrap" style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form className="upload-card" style={{ maxWidth: 380, width: '100%' }} onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 20, borderBottom: 'none' }}>
          <img src="/crest.png" alt="Brasão" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 10, boxShadow: '0 0 0 1px var(--ink), 0 0 0 4px #fff, 0 0 0 5px var(--line)' }} />
          <div className="eyebrow" style={{ justifyContent: 'center', marginBottom: 6 }}>
            <b>Acesso Restrito</b>
          </div>
          <h2 style={{ margin: '0 0 4px', border: 'none', padding: 0 }}>Boletim da Folha de Pagamento</h2>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Prefeitura Municipal de São Miguel dos Campos</div>
        </div>

        <div className="file-row">
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="file-row">
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="btn" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        {error && <div className="msg msg-error">{error}</div>}
      </form>
    </div>
  );
}
