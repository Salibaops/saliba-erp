# SALIBA ERP

## Deploy na Vercel (5 minutos)

### 1. Suba no GitHub
1. Vai em github.com → "New Repository" → nome: `saliba-erp` → Create
2. Descompacte este ZIP no seu computador
3. No terminal, dentro da pasta:
```bash
git init
git add .
git commit -m "SALIBA ERP v1"
git remote add origin https://github.com/SEU-USUARIO/saliba-erp.git
git push -u origin main
```

### 2. Deploy na Vercel
1. Vai em vercel.com → "Add New Project"
2. Importa o repositório `saliba-erp` do GitHub
3. Framework: Vite
4. Clica "Deploy"
5. Em 1-2 minutos vai ter o link público!

### 3. Variáveis de ambiente (opcional)
Se quiser mudar as credenciais do Supabase depois:
- Na Vercel → Settings → Environment Variables
- Adicione: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

## Banco de dados
O SQL pra criar as tabelas está no arquivo `schema.sql`.
Rode no Supabase → SQL Editor se ainda não fez.

## Stack
- React + Vite
- Supabase (PostgreSQL)
- Vercel (hosting)
