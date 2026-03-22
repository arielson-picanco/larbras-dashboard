# LARBRAS — Backend

## Instalação

```bash
cd backend
npm install
cp .env.example .env
# Preencha o .env com suas credenciais
npm run dev
```

## Variáveis de ambiente necessárias

| Variável | Onde obter |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → service_role |
| `JWT_SECRET` | Gere com: `openssl rand -base64 64` |
| `OMIE_APP_KEY` | https://developer.omie.com.br/my-apps/ |
| `OMIE_APP_SECRET` | https://developer.omie.com.br/my-apps/ |

## Configurar o Supabase

1. Acesse https://supabase.com e crie um projeto
2. Vá em **SQL Editor** e execute o arquivo `supabase/schema.sql`
3. Copie a `URL` e a chave `service_role` para o `.env`

## Criar primeiro usuário admin

Após configurar o `.env` e iniciar o servidor, crie o primeiro admin diretamente no Supabase:

1. No Supabase Dashboard → **Authentication** → **Users** → **Add user**
2. Informe email e senha
3. No **SQL Editor**, execute:
```sql
UPDATE public.profiles SET role = 'admin' WHERE id = '<uuid-do-usuario>';
```

Ou via API (após ter um admin logado):
```bash
curl -X POST http://localhost:3001/api/auth/users \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{"email":"novo@email.com","password":"senha123","name":"Nome","role":"gerente"}'
```

## Ativar modo backend no frontend

No arquivo `frontend/.env.local`:
```
VITE_USE_API=true
VITE_API_URL=http://localhost:3001
```

## Sincronização com Omiê

- Automática: todo dia às **06:00 (America/Manaus)**
- Manual: `POST /api/sync/run` (requer token admin)
- Status: `GET /api/sync/status`
