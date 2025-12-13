import React, { useState } from 'react';
import { Shield, UserPlus, LogIn, Sword, Crown } from 'lucide-react';
import { User, UserRole } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('PLAYER');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Preencha todos os campos.');
      return;
    }

    const storedUsersStr = localStorage.getItem('rpg_users');
    const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];

    if (isRegistering) {
      if (users.find(u => u.username === username)) {
        setError('Usuário já existe.');
        return;
      }
      const newUser: User = { username, password, role };
      users.push(newUser);
      localStorage.setItem('rpg_users', JSON.stringify(users));
      onLogin(newUser);
    } else {
      const user = users.find(u => u.username === username && u.password === password);
      if (user) {
        // Fallback para usuários antigos sem role definida
        if (!user.role) user.role = 'PLAYER'; 
        onLogin(user);
      } else {
        setError('Credenciais inválidas.');
      }
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
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Nome de Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              placeholder="Ex: Gandalf"
            />
          </div>
          
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              placeholder="******"
            />
          </div>

          {isRegistering && (
             <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">Eu sou um:</label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setRole('PLAYER')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-colors ${role === 'PLAYER' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                        <Shield className="w-4 h-4" /> Jogador
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole('GM')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-colors ${role === 'GM' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                        <Crown className="w-4 h-4" /> Mestre
                    </button>
                </div>
             </div>
          )}

          {error && <p className="text-red-500 text-sm text-center bg-red-950/20 p-2 rounded border border-red-900/50">{error}</p>}

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
          >
            {isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            {isRegistering ? 'Criar Conta' : 'Entrar no Portal'}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <button
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
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