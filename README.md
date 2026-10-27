# Ritmo — Checklist diário ✅

Um app simples e bonito para montar sua rotina, marcar as tarefas do dia e acompanhar sua constância.

## O que ele faz

- **Checklist do dia**: as tarefas se renovam automaticamente todo dia, separadas por Manhã, Tarde, Noite e Qualquer hora.
- **Dias da semana**: cada tarefa pode repetir todo dia, só nos dias úteis, só no fim de semana etc.
- **Progresso**: anel de progresso do dia, sequência de dias 🔥, melhor sequência, taxa dos últimos 30 dias e calendário das últimas 5 semanas.
- **Corrigir dias anteriores**: esqueceu de marcar ontem? Toque no dia no calendário.
- **Adicionar por voz**: toque no microfone 🎤 ao lado do nome da tarefa e fale.
- **Modelos prontos**: Manhã produtiva, Saúde em dia, Noite tranquila, Estudos e trabalho.
- **Compartilhar**: convide amigos com o link do app ou envie sua rotina para eles copiarem com um toque.
- **Instalável e offline**: funciona como app no celular (PWA), até sem internet.
- **Tema claro/escuro** e **backup** (exportar/restaurar arquivo).

Os dados ficam salvos só no aparelho de cada pessoa (nada vai para servidor).

## Como testar no computador

Abra um terminal na pasta do projeto e rode:

```bash
python3 -m http.server 8000
```

Depois acesse <http://localhost:8000>.

## Como publicar para seus amigos (grátis, com GitHub Pages)

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main` e pasta `/ (root)`. Salve.
3. Em 1–2 minutos o app fica disponível em `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.
4. Mande o link para os amigos. No celular, eles podem tocar em **Adicionar à Tela de Início** para usar como app.

> Ao publicar uma versão nova, aumente o número em `CACHE` no arquivo `sw.js` (ex.: `ritmo-v2`) para que todos recebam a atualização.

## Estrutura

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | Estrutura da página |
| `styles.css` | Visual (cores, tema claro/escuro) |
| `app.js` | Toda a lógica do app |
| `sw.js` | Funcionamento offline |
| `manifest.webmanifest` | Nome, ícone e cores quando instalado |
| `icons/` | Ícones do app |

## Próximos passos para vender

- **Domínio próprio** (ex.: `ritmoapp.com.br`) apontando para o GitHub Pages ou Netlify/Vercel.
- **Conta e sincronização na nuvem** (ex.: Supabase ou Firebase) para usar em vários aparelhos.
- **Plano Premium**: lembretes por notificação, estatísticas avançadas, temas extras — cobrança via Stripe, Mercado Pago ou assinaturas das lojas.
- **Lojas de apps**: empacotar com [Capacitor](https://capacitorjs.com/) para publicar na Google Play e App Store.
- **Termos de uso e política de privacidade** (exigidos pelas lojas e pela LGPD quando houver contas).
