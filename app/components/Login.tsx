import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { LockKeyhole, AlertCircle } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            console.error(err);
            setError('Credenciales inválidas. Acceso denegado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-300 p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-sm shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 bg-zinc-800 rounded-sm flex items-center justify-center mb-4 transition-colors hover:bg-teal-500/20 group">
                        <LockKeyhole className="w-6 h-6 text-zinc-500 group-hover:text-teal-500 transition-colors" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-widest text-white">Acceso Restringido</h1>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-900/50 p-3 rounded-sm flex items-center gap-2 text-red-500 text-xs font-bold uppercase tracking-wide">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-zinc-500">Credencial de Usuario</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-sm text-white focus:border-teal-500 focus:outline-none transition-colors"
                            placeholder="usuario@tms.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-zinc-500">Contraseña de Acceso</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-sm text-white focus:border-teal-500 focus:outline-none transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-widest py-3 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-teal-500/20"
                    >
                        {loading ? 'Verificando...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-zinc-600 text-[10px] uppercase tracking-widest">
                        Tech Machine Shop Security System
                    </p>
                </div>
            </div>
        </div>
    );
}
