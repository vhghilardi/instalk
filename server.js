require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const InstagramAuth = require('./auth-alternative'); // Usando versão alternativa para evitar challenges
const InstagramMessaging = require('./messaging');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'instagram-app-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Instâncias globais
let instagramAuth = null;
let instagramMessaging = null;

// Middleware para verificar autenticação
const requireAuth = (req, res, next) => {
    if (req.session.isLoggedIn && instagramAuth) {
        next();
    } else {
        res.redirect('/');
    }
};

// Rota principal - Login
app.get('/', (req, res) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

// Processar login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.render('login', { error: 'Username e senha são obrigatórios!' });
    }
    
    try {
        instagramAuth = new InstagramAuth();
        const loginResult = await instagramAuth.login(username, password);
        
        if (loginResult.success) {
            req.session.isLoggedIn = true;
            req.session.username = username;
            instagramMessaging = new InstagramMessaging(instagramAuth.getIgClient());
            res.redirect('/dashboard');
        } else {
            // Renderizar com erro específico baseado no tipo
            let errorMessage = loginResult.message || 'Falha no login. Verifique suas credenciais.';
            
            if (loginResult.error === 'challenge_required') {
                errorMessage = `
                    <strong>Verificação Adicional Necessária</strong><br>
                    ${loginResult.message}<br><br>
                    <strong>Soluções:</strong><br>
                    1. Faça login no app oficial do Instagram<br>
                    2. Complete qualquer verificação solicitada<br>
                    3. Aguarde 10-15 minutos<br>
                    4. Tente novamente aqui
                `;
            } else if (loginResult.error === 'rate_limit') {
                errorMessage = `
                    <strong>Limite de Tentativas Atingido</strong><br>
                    ${loginResult.message}<br><br>
                    Aguarde pelo menos 15 minutos antes de tentar novamente.
                `;
            }
            
            res.render('login', { error: errorMessage });
        }
    } catch (error) {
        console.error('Erro no login:', error.message);
        res.render('login', { error: 'Erro inesperado no login: ' + error.message });
    }
});

// Dashboard principal
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        // Buscar informações do usuário
        const currentUser = await instagramMessaging.getCurrentUserInfo();
        
        // Buscar conversas
        const conversations = await instagramMessaging.getDirectMessagesData(10);
        
        res.render('dashboard', {
            user: currentUser,
            conversations: conversations,
            username: req.session.username
        });
    } catch (error) {
        console.error('Erro no dashboard:', error.message);
        res.render('dashboard', {
            user: null,
            conversations: [],
            username: req.session.username,
            error: 'Erro ao carregar dados: ' + error.message
        });
    }
});

// API para buscar usuário
app.post('/api/search-user', requireAuth, async (req, res) => {
    const { username } = req.body;
    
    try {
        const user = await instagramMessaging.searchUser(username);
        res.json({ success: true, user: user });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// API para enviar mensagem
app.post('/api/send-message', requireAuth, async (req, res) => {
    const { recipient, message, type } = req.body;
    
    try {
        let result;
        if (type === 'username') {
            result = await instagramMessaging.sendMessage(recipient, message);
        } else if (type === 'thread') {
            result = await instagramMessaging.sendMessageToThread(recipient, message);
        }
        
        res.json({ success: true, result: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// API para buscar mensagens de uma conversa
app.get('/api/thread/:threadId/messages', requireAuth, async (req, res) => {
    let { threadId } = req.params;
    const limit = req.query.limit || 20;
    
    // Decodificar threadId
    threadId = decodeURIComponent(threadId);
    
    // Validar threadId
    if (!threadId || threadId === 'undefined' || threadId === 'null' || threadId.trim() === '') {
        return res.json({ 
            success: false, 
            error: 'Thread ID inválido ou não fornecido' 
        });
    }
    
    console.log(`Buscando mensagens para thread: ${threadId}`);
    
    try {
        const messages = await instagramMessaging.getMessagesFromThreadData(threadId, parseInt(limit));
        res.json({ success: true, messages: messages });
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// Logout
app.post('/logout', requireAuth, async (req, res) => {
    try {
        if (instagramAuth) {
            await instagramAuth.logout();
        }
        req.session.destroy();
        instagramAuth = null;
        instagramMessaging = null;
        res.redirect('/');
    } catch (error) {
        console.error('Erro no logout:', error.message);
        res.redirect('/');
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log('📱 Acesse o navegador para usar a aplicação web');
});
