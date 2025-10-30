# Instagram Manager

Um painel de gerenciamento para múltiplas instâncias do Instagram, similar à Evolution API. Permite criar, gerenciar e usar remotamente várias contas do Instagram através de uma API REST com autenticação por token fixo.

## 🚀 Funcionalidades

- **Painel Web**: Interface moderna para gerenciar instâncias
- **API REST**: Acesso programático a todas as funcionalidades
- **Múltiplas Instâncias**: Gerencie várias contas do Instagram simultaneamente
- **Token Fixo**: Autenticação simples e segura via token configurável
- **Logs em Tempo Real**: Monitoramento completo das atividades
- **Persistência de Dados**: Banco de dados SQLite para armazenamento
- **Rate Limiting**: Proteção contra abuso da API
- **Interface Responsiva**: Funciona em desktop e mobile

## 📋 Pré-requisitos

- Node.js 16+ 
- npm ou yarn
- Contas do Instagram válidas

## 🛠️ Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd instalk
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp config.example.env .env
```

Edite o arquivo `.env` com suas configurações:
```env
PORT=3000
API_TOKEN=seu-token-personalizado-aqui
SESSION_SECRET=seu-session-secret-aqui
DB_PATH=./instagram_manager.db
```

4. **Inicie o servidor**
```bash
npm start
```

Para desenvolvimento:
```bash
npm run dev
```

## 🌐 Acesso

- **Painel Web**: http://localhost:3000
- **API REST**: http://localhost:3000/api

### Autenticação
- **Token Fixo**: Configure no arquivo `.env` (variável `API_TOKEN`)
- **Sem Login/Senha**: Apenas token para acesso à API

## 📚 API REST

### Autenticação

O sistema usa um token fixo configurado no arquivo `.env`. Use este token em todas as requisições:

```bash
# Obter o token configurado
curl http://localhost:3000/api/token

# Usar o token em requisições
curl -H "Authorization: Bearer SEU_TOKEN" http://localhost:3000/api/instances
```

### Configuração do Token

1. **Edite o arquivo `.env`**:
```env
API_TOKEN=meu-token-super-seguro-123
```

2. **Reinicie o servidor**:
```bash
npm start
```

3. **Use o token** em todas as requisições à API

### Endpoints Principais

#### Instâncias
- `GET /api/instances` - Listar todas as instâncias
- `POST /api/instances` - Criar nova instância
- `GET /api/instances/:id` - Obter instância específica
- `POST /api/instances/:id/connect` - Conectar instância
- `POST /api/instances/:id/disconnect` - Desconectar instância
- `DELETE /api/instances/:id` - Deletar instância

#### Mensagens
- `POST /api/instances/:id/send-message` - Enviar mensagem
- `GET /api/instances/:id/conversations` - Listar conversas
- `GET /api/instances/:id/threads/:threadId/messages` - Obter mensagens

#### Usuários
- `GET /api/instances/:id/search-user?username=USERNAME` - Buscar usuário
- `GET /api/instances/:id/user-info?userId=USER_ID` - Informações do usuário

#### Sistema
- `GET /api/instances/:id/status` - Status da instância
- `GET /api/logs` - Logs do sistema
- `GET /api/token` - Obter token da API

### Exemplos de Uso com CURL

#### 1. Obter Token da API
```bash
curl http://localhost:3000/api/token
```

#### 2. Listar Instâncias
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:3000/api/instances
```

#### 3. Criar Nova Instância
```bash
curl -X POST http://localhost:3000/api/instances \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Minha Conta",
    "username": "meu_username",
    "password": "minha_senha"
  }'
```

#### 4. Conectar Instância
```bash
curl -X POST http://localhost:3000/api/instances/INSTANCE_ID/connect \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "minha_senha"
  }'
```

#### 5. Desconectar Instância
```bash
curl -X POST http://localhost:3000/api/instances/INSTANCE_ID/disconnect \
  -H "Authorization: Bearer SEU_TOKEN"
```

#### 6. Obter Status da Instância
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:3000/api/instances/INSTANCE_ID/status
```

#### 7. Enviar Mensagem
```bash
curl -X POST http://localhost:3000/api/instances/INSTANCE_ID/send-message \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "usuario_destino",
    "message": "Olá! Esta é uma mensagem automática."
  }'
```

#### 8. Buscar Usuário
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  "http://localhost:3000/api/instances/INSTANCE_ID/search-user?username=usuario_busca"
```

#### 9. Obter Informações do Usuário
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  "http://localhost:3000/api/instances/INSTANCE_ID/user-info?userId=123456789"
```

#### 10. Listar Conversas
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  "http://localhost:3000/api/instances/INSTANCE_ID/conversations?limit=20"
```

#### 11. Obter Mensagens de uma Conversa
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  "http://localhost:3000/api/instances/INSTANCE_ID/threads/THREAD_ID/messages"
```

#### 12. Deletar Instância
```bash
curl -X DELETE http://localhost:3000/api/instances/INSTANCE_ID \
  -H "Authorization: Bearer SEU_TOKEN"
```

#### 13. Obter Logs do Sistema
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  "http://localhost:3000/api/logs?level=info&limit=50"
```

## 🎯 Uso do Painel Web

1. **Acesse** http://localhost:3000
2. **Configure seu token** no arquivo `.env`
3. **Crie instâncias** clicando em "Nova Instância"
4. **Gerencie instâncias** através da interface intuitiva
5. **Monitore logs** em tempo real
6. **Obtenha seu token API** no menu de configurações

## 🔧 Configuração Avançada

### Variáveis de Ambiente
```env
# Porta do servidor
PORT=3000

# Token fixo para autenticação da API
API_TOKEN=meu-token-super-seguro-123

# Chave secreta para sessões
SESSION_SECRET=minha-chave-secreta-session

# Caminho do banco de dados
DB_PATH=./instagram_manager.db
```

### Banco de Dados
O sistema usa SQLite por padrão. O arquivo é criado automaticamente em `instagram_manager.db`.

### Rate Limiting
- 100 requests por IP a cada 15 minutos
- Configurável no arquivo `server.js`

### Segurança
- **Token Fixo**: Configure um token forte e único
- **HTTPS**: Use HTTPS em produção
- **Firewall**: Configure regras de acesso adequadas

## 📊 Monitoramento

O sistema inclui logs detalhados para:
- Criação/remoção de instâncias
- Tentativas de login
- Envio de mensagens
- Erros e exceções
- Atividade geral

## ⚠️ Importante

- **Use apenas para fins educacionais**
- **Respeite os termos de uso do Instagram**
- **Não abuse da API para evitar bloqueios**
- **Mantenha seu token seguro**
- **Use proxies se necessário**
- **Configure um token forte e único**

## 🐛 Solução de Problemas

### Erro de Challenge Required
1. Faça login no app oficial do Instagram
2. Complete qualquer verificação solicitada
3. Aguarde 10-15 minutos
4. Tente novamente

### Rate Limit
- Aguarde 15-30 minutos antes de tentar novamente
- Use proxies diferentes se necessário

### Instância Desconectada
- Verifique se as credenciais estão corretas
- Tente recriar a instância
- Verifique os logs para mais detalhes

## 📝 Changelog

### v2.0.0
- ✅ Sistema de múltiplas instâncias
- ✅ API REST completa
- ✅ Painel web moderno
- ✅ Autenticação por token fixo
- ✅ Sistema de logs
- ✅ Banco de dados SQLite
- ✅ Rate limiting
- ✅ Monitoramento em tempo real
- ✅ Interface responsiva
- ✅ Exemplos de CURL completos

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir funcionalidades
- Enviar pull requests
- Melhorar a documentação

## 📄 Licença

Este projeto é para fins educacionais. Use com responsabilidade e respeite os termos de uso do Instagram.

---

**Desenvolvido com ❤️ para a comunidade**