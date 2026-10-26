import React, { useState } from 'react';
import { UserPlus, LogIn, Sword, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// A sessão é tratada no App via supabase.auth.onAuthStateChange
const Auth: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!email.trim() || !password.trim() || (isRegistering && !username.trim())) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const name = username.trim();
        if (name.length < 2 || name.length > 32) {
          setError('O nome de usuário deve ter entre 2 e 32 caracteres.');
          return;
        }
        const { data: available } = await supabase.rpc('username_available', { name });
        if (available === false) {
          setError('Nome de usuário já existe.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: name }, emailRedirectTo: window.location.origin },
        });
        if (error) {
          setError(translateAuthError(error.message));
        } else if (!data.session) {
          setInfo('Conta criada! Confirme o cadastro pelo link enviado ao seu e-mail e depois entre.');
          setIsRegistering(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(translateAuthError(error.message));
      }
    } finally {
      setLoading(false);
    }
  };

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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              placeholder="voce@exemplo.com"
            />
          </div>

          {isRegistering && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Nome de Usuário</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="Ex: Gandalf"
              />
              <p className="text-xs text-slate-600 mt-1">É assim que o Mestre e os outros jogadores vão te ver.</p>
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              placeholder="******"
            />
          </div>

          {info && <p className="text-emerald-400 text-sm text-center bg-emerald-950/20 p-2 rounded border border-emerald-900/50">{info}</p>}
          {error && <p className="text-red-500 text-sm text-center bg-red-950/20 p-2 rounded border border-red-900/50">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full disabled:opacity-60 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
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

const translateAuthError = (message: string) => {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar.';
  if (/already registered/i.test(message)) return 'Este e-mail já tem uma conta.';
  if (/password should be at least/i.test(message)) return 'A senha precisa ter pelo menos 6 caracteres.';
  return message;
};

export default Auth;