import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, KeyRound, Loader2, MailCheck, UploadCloud, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button, Field, Input } from '@/components/ui';
import {
  aceitarConvite, criarAgencia, criarConta, definirNovaSenha, entrar, guardarConvite,
  pedirNovaSenha, sair, useSessao, verConvite,
} from '@/lib/nuvem/sessao';
import { descartarDesteAparelho, importarDesteAparelho, useNuvemStatus } from '@/lib/nuvem/sincronizar';

/* ------------------------------------------------------------------ */
/*  Moldura comum                                                      */
/* ------------------------------------------------------------------ */

function Moldura({ children, voltar = true }: { children: React.ReactNode; voltar?: boolean }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-ink-900 lg:block">
        <div className="hairline-grid absolute inset-0 opacity-70" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div>
            <h2 className="font-display text-4xl font-semibold leading-tight text-white">
              A operação da agência,
              <br />
              num só lugar.
            </h2>
            <p className="mt-4 max-w-sm text-white/55">
              Posts, vídeos, clientes, financeiro e automações. A equipe inteira vê a mesma
              coisa, em qualquer aparelho, na hora.
            </p>
          </div>
          <p className="text-xs tracking-wide text-white/35">Orikay</p>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6">
        {voltar && (
          <Link to="/" className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
            <ArrowLeft size={16} /> Voltar
          </Link>
        )}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}

function Erro({ texto }: { texto: string }) {
  if (!texto) return null;
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{texto}</div>;
}

function Aviso({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <div className="flex gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-200">
      <MailCheck size={18} className="mt-0.5 shrink-0" />
      <span>{texto}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Entrar / criar conta da agência / esqueci a senha                  */
/* ------------------------------------------------------------------ */

type Modo = 'entrar' | 'criar' | 'esqueci';

export function Entrar({ convite }: { convite?: { agencia: string } }) {
  const [modo, setModo] = useState<Modo>(convite ? 'criar' : 'entrar');
  const [nome, setNome] = useState('');
  const [agencia, setAgencia] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setAviso(''); setCarregando(true);
    const r = modo === 'entrar'
      ? await entrar(email, senha)
      : modo === 'criar'
        ? await criarConta({ nome, email, senha, agencia: convite ? undefined : agencia, cargo: convite ? 'Equipe' : 'Direção' })
        : await pedirNovaSenha(email);
    setCarregando(false);
    if (!r.ok) return setErro(r.erro);
    if (r.aviso) setAviso(r.aviso);
  }

  const titulo = convite
    ? (modo === 'entrar' ? 'Entre para aceitar o convite' : `Entrar na ${convite.agencia}`)
    : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar a conta da agência' : 'Criar uma senha nova';

  return (
    <Moldura>
      <h1 className="text-2xl font-semibold text-white">{titulo}</h1>
      <p className="mt-1.5 text-sm text-white/50">
        {modo === 'entrar' && 'Use o e-mail e a senha da sua conta.'}
        {modo === 'criar' && (convite ? 'Crie sua conta. Você entra direto na equipe.' : 'Você vira o administrador e convida a equipe depois.')}
        {modo === 'esqueci' && 'Mandamos um link para o seu e-mail.'}
      </p>

      <form onSubmit={enviar} className="mt-7 space-y-4">
        {modo === 'criar' && (
          <>
            <Field label="Seu nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Marina Couto" autoFocus autoComplete="name" /></Field>
            {!convite && (
              <Field label="Nome da agência"><Input value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="Ex.: Sá Pinheiro Comunicação" /></Field>
            )}
          </>
        )}
        <Field label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@agencia.com.br" autoFocus={modo !== 'criar'} autoComplete="email" />
        </Field>
        {modo !== 'esqueci' && (
          <Field label="Senha" hint={modo === 'criar' ? 'No mínimo 6 caracteres.' : undefined}>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••"
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} />
          </Field>
        )}

        <Erro texto={erro} />
        <Aviso texto={aviso} />

        <Button type="submit" size="lg" className="w-full" disabled={carregando}>
          {carregando && <Loader2 size={18} className="animate-spin" />}
          {modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Mandar o link'}
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-white/45">
        {modo === 'entrar' && (
          <>
            <button onClick={() => { setModo('esqueci'); setErro(''); setAviso(''); }} className="block w-full hover:text-white">Esqueci a senha</button>
            <button onClick={() => { setModo('criar'); setErro(''); setAviso(''); }} className="block w-full hover:text-white">
              {convite ? 'Ainda não tenho conta' : 'Sua agência ainda não usa o Orikay? Criar conta'}
            </button>
          </>
        )}
        {modo !== 'entrar' && (
          <button onClick={() => { setModo('entrar'); setErro(''); setAviso(''); }} className="block w-full hover:text-white">Já tenho conta, quero entrar</button>
        )}
      </div>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ */
/*  Convite: /convite/:token                                           */
/* ------------------------------------------------------------------ */

export function ConvitePagina() {
  const { token = '' } = useParams();
  const fase = useSessao((s) => s.fase);
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ agencia: string; cargo: string; valido: boolean } | null | undefined>(undefined);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    void verConvite(token).then(setInfo);
  }, [token]);

  // Logado: aceita na hora e vai para a plataforma.
  useEffect(() => {
    if (!info?.valido || entrando) return;
    if (fase === 'pronta' || fase === 'sem-agencia') {
      setEntrando(true);
      void aceitarConvite(token).then((r) => {
        if (!r.ok) { setErro(r.erro); setEntrando(false); return; }
        navigate('/app/posts', { replace: true });
      });
    } else if (fase === 'deslogado') {
      guardarConvite(token);
    }
  }, [fase, info, token, entrando, navigate]);

  if (info === undefined || fase === 'carregando' || entrando) return <Carregando texto="Abrindo o convite…" />;

  if (!info || !info.valido) {
    return (
      <Moldura>
        <h1 className="text-2xl font-semibold text-white">Convite indisponível</h1>
        <p className="mt-2 text-sm text-white/55">
          {info ? 'Este convite já foi usado ou expirou.' : 'Não encontramos este convite.'} Peça um link novo
          para quem administra a agência.
        </p>
      </Moldura>
    );
  }

  if (erro) {
    return <Moldura><h1 className="text-2xl font-semibold text-white">Não deu para entrar</h1><div className="mt-4"><Erro texto={erro} /></div></Moldura>;
  }

  return <Entrar convite={{ agencia: info.agencia }} />;
}

/* ------------------------------------------------------------------ */
/*  Logado mas sem agência                                             */
/* ------------------------------------------------------------------ */

export function SemAgencia() {
  const user = useSessao((s) => s.user);
  const [agencia, setAgencia] = useState('');
  const [nome, setNome] = useState((user?.user_metadata?.nome as string) ?? '');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setCarregando(true);
    const r = await criarAgencia(agencia, nome);
    setCarregando(false);
    if (!r.ok) setErro(r.erro);
  }

  return (
    <Moldura voltar={false}>
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-850 text-white/60">
        <Building2 size={20} strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-white">Você ainda não está em nenhuma agência</h1>
      <p className="mt-1.5 text-sm text-white/50">
        Se alguém da sua equipe já usa o Orikay, peça o link de convite. Ou crie a agência agora.
      </p>
      <form onSubmit={criar} className="mt-7 space-y-4">
        <Field label="Seu nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="Nome da agência"><Input value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="Ex.: Sá Pinheiro Comunicação" autoFocus /></Field>
        <Erro texto={erro} />
        <Button type="submit" size="lg" className="w-full" disabled={carregando}>
          {carregando && <Loader2 size={18} className="animate-spin" />} Criar agência
        </Button>
      </form>
      <button onClick={() => void sair()} className="mt-6 w-full text-center text-sm text-white/40 hover:text-white">
        Entrar com outra conta ({user?.email})
      </button>
    </Moldura>
  );
}

/* ------------------------------------------------------------------ */
/*  Link de "esqueci a senha"                                          */
/* ------------------------------------------------------------------ */

export function NovaSenha() {
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha !== repetir) return setErro('As duas senhas não são iguais.');
    setCarregando(true);
    const r = await definirNovaSenha(senha);
    setCarregando(false);
    if (!r.ok) setErro(r.erro);
  }

  return (
    <Moldura voltar={false}>
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-850 text-white/60">
        <KeyRound size={20} strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-white">Crie sua senha nova</h1>
      <form onSubmit={salvar} className="mt-7 space-y-4">
        <Field label="Nova senha" hint="No mínimo 6 caracteres.">
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus autoComplete="new-password" />
        </Field>
        <Field label="Repita a nova senha">
          <Input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
        </Field>
        <Erro texto={erro} />
        <Button type="submit" size="lg" className="w-full" disabled={carregando}>
          {carregando && <Loader2 size={18} className="animate-spin" />} Salvar e entrar
        </Button>
      </form>
    </Moldura>
  );
}

export function Carregando({ texto = 'Carregando a agência…' }: { texto?: string }) {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex items-center gap-3 text-sm text-white/50">
        <Loader2 size={18} className="animate-spin" /> {texto}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dados de antes da nuvem neste aparelho                             */
/* ------------------------------------------------------------------ */

export function ImportarLegado() {
  const legado = useNuvemStatus((s) => s.legado);
  const agencia = useSessao((s) => s.agencias.find((a) => a.id === s.agenciaId)?.nome);
  const [indo, setIndo] = useState<'importar' | 'descartar' | null>(null);
  if (!legado) return null;

  async function escolher(op: 'importar' | 'descartar') {
    setIndo(op);
    if (op === 'importar') await importarDesteAparelho();
    else await descartarDesteAparelho();
    setIndo(null);
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-7">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-850 text-white/60">
          <UploadCloud size={20} strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">Este aparelho tem dados de antes da nuvem</h2>
        <p className="mt-2 text-sm text-white/55">
          Encontramos {legado.clientes} cliente(s), {legado.posts} post(s) e {legado.videos} vídeo(s) salvos só neste
          navegador. Quer levar tudo para a {agencia ?? 'agência'}? Depois disso, a equipe inteira vê os mesmos
          dados em qualquer aparelho.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1 justify-center" disabled={!!indo} onClick={() => void escolher('importar')}>
            {indo === 'importar' && <Loader2 size={16} className="animate-spin" />} Levar para a agência
          </Button>
          <Button variant="outline" className="flex-1 justify-center" disabled={!!indo} onClick={() => void escolher('descartar')}>
            {indo === 'descartar' && <Loader2 size={16} className="animate-spin" />} Começar do zero
          </Button>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-white/40">
          <Users size={14} className="mt-px shrink-0" />
          Faça isso em um aparelho só, o que tiver os dados mais completos. Os outros recebem tudo da nuvem.
        </p>
      </div>
    </div>
  );
}
