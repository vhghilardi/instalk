# Instagram Messaging App

Uma aplicação Node.js para testar os recursos de envio e leitura de mensagens do Instagram usando a biblioteca `instagram-private-api`.

## 🚀 Funcionalidades

- ✅ **Interface Web Moderna** - Dashboard visual com Bootstrap
- ✅ **Interface CLI** - Versão linha de comando também disponível
- ✅ Login automático com persistência de sessão
- ✅ Visualizar informações do usuário logado
- ✅ Buscar usuários por username
- ✅ Listar conversas diretas
- ✅ Ler mensagens de conversas específicas
- ✅ Enviar mensagens para usuários
- ✅ Enviar mensagens para conversas existentes
- ✅ Interface responsiva para mobile

## 📦 Instalação

1. Clone ou baixe este projeto
2. Instale as dependências:
```bash
npm install
```

3. Configure suas credenciais do Instagram:
   - Copie o arquivo `config.example.env` para `.env`
   - Edite o arquivo `.env` com suas credenciais:
```env
INSTAGRAM_USERNAME=seu_username
INSTAGRAM_PASSWORD=sua_senha
```

## 🎯 Como usar

### 🌐 Interface Web (Recomendado)

1. Execute a aplicação web:
```bash
npm start
```

2. Abra o navegador em: `http://localhost:3000`

3. Faça login com suas credenciais do Instagram

4. Use a interface visual para:
   - **Buscar usuários** por username
   - **Ver conversas** na barra lateral
   - **Ler mensagens** clicando nas conversas
   - **Enviar mensagens** para usuários ou threads
   - **Visualizar informações** do seu perfil

### 💻 Interface CLI (Linha de Comando)

1. Execute a versão CLI:
```bash
npm run cli
```

2. Use o menu interativo:
   - **1**: Ver suas informações
   - **2**: Buscar usuário
   - **3**: Ver conversas
   - **4**: Ler mensagens de uma conversa
   - **5**: Enviar mensagem para usuário
   - **6**: Enviar mensagem para conversa
   - **7**: Logout
   - **0**: Sair

## ⚠️ Importante

- **Use com responsabilidade**: Esta aplicação é apenas para fins educacionais e de teste
- **Rate limiting**: O Instagram tem limites de requisições, evite fazer muitas operações rapidamente
- **Segurança**: Nunca compartilhe suas credenciais ou o arquivo `.env`
- **Sessão**: A aplicação salva a sessão em `session.json` para evitar login repetido

## 🔧 Estrutura do projeto

```
instagram2/
├── server.js             # Servidor web Express
├── index.js              # Aplicação CLI
├── auth.js               # Módulo de autenticação
├── messaging.js          # Módulo de mensagens
├── views/                # Templates EJS
│   ├── login.ejs         # Página de login
│   └── dashboard.ejs     # Dashboard principal
├── public/               # Arquivos estáticos
│   ├── css/style.css     # Estilos CSS
│   └── js/               # JavaScript do frontend
├── package.json          # Dependências
├── config.example.env    # Exemplo de configuração
└── session.json          # Sessão salva (criado automaticamente)
```

## 🐛 Solução de problemas

### Erro de login
- Verifique se suas credenciais estão corretas
- Certifique-se de que a autenticação de dois fatores está desabilitada temporariamente
- Tente deletar o arquivo `session.json` e fazer login novamente

### Rate limiting
- Aguarde alguns minutos antes de tentar novamente
- Reduza a frequência das operações

### Usuário não encontrado
- Verifique se o username está correto (sem @)
- Certifique-se de que o usuário existe e não está privado

## 📝 Notas

- A biblioteca `instagram-private-api` é não-oficial e pode parar de funcionar a qualquer momento
- Sempre respeite os termos de serviço do Instagram
- Use esta aplicação apenas para fins educacionais e de teste pessoal
