import React, { useState } from 'react';
import { UserPlus, LogIn, Sword, Loader2 } from 'lucide-react';
import { signIn, signUp } from '../services/campaignRepo';

// O login é feito no Supabase; o App percebe a sessão nova pelo onAuthStateChange.
const Auth: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!email.trim() || !password.trim() || (isRegistering && !username.trim())) {
      setError('Preencha todos os campos.');
      return;
    }
    if (isRegistering && password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      if (isRegistering) {
        const active = await signUp(email.trim(), password, username.trim());
        if (!active) {
          setInfo('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.');
          setIsRegistering(false);
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-fade-in relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>

        <div className="text-center mb-8 relative z-10">
            <div className="inline-flex items-center justify-center p-4 bg-slate-950 border border-slate-800 rounded-full mb-4 shadow-lg">
                <Sword className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-3xl font-bold text-slate-100 cinzel">Crônicas de Mesa</h1>
            <p className="text-slate-400 mt-2">Identifique-se, aventureiro.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="voce@exemplo.com"
            />
          </div>

          {isRegistering && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Nome de Usuário</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                placeholder="Ex: Gandalf"
                maxLength={30}
              />
              <p className="text-xs text-slate-600 mt-1">É como o Mestre e os outros jogadores vão te ver.</p>
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Senha</label>
            <input
              type="password"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="******"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center bg-red-950/20 p-2 rounded border border-red-900/50">{error}</p>}
          {info && <p className="text-emerald-400 text-sm text-center bg-emerald-950/20 p-2 rounded border border-emerald-900/50">{info}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
          >
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : (isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />)}
            {isRegistering ? 'Criar Conta' : 'Entrar no Portal'}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <button
            onClick={() => { setIsRegistering(!isRegistering); setError(''); setInfo(''); }}
            className="text-sm text-slate-500 hover:text-amber-500 transition-colors"
          >
            {isRegistering ? 'Já possui uma conta? Entrar' : 'Novo por aqui? Criar conta'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
