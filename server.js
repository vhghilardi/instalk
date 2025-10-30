const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const Database = require('./database');
const InstanceManager = require('./instanceManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar banco de dados e gerenciador de instâncias
const database = new Database();
const instanceManager = new InstanceManager(database);

// Middleware de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // máximo 100 requests por IP
});
app.use(limiter);

// Middleware para parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração de sessão
app.use(session({
    secret: process.env.SESSION_SECRET || 'instagram-manager-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para verificar token fixo
const requireTokenAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token de acesso necessário' });
    }

    const authResult = database.verifyToken(token);
    if (!authResult.success) {
        return res.status(401).json({ success: false, error: authResult.message });
    }
    
    next();
};

// Rota principal - Dashboard
app.get('/', (req, res) => {
    res.render('dashboard', { 
        title: 'Instagram Manager',
        instances: [],
        stats: {
            total: 0,
            connected: 0,
            disconnected: 0
        }
    });
});

// Rota para obter token da API
app.get('/api/token', (req, res) => {
    const token = process.env.API_TOKEN || 'instagram-manager-token';
    res.json({ success: true, token: token });
});

// ===== ROTAS DA API =====

// Listar todas as instâncias
app.get('/api/instances', requireTokenAuth, async (req, res) => {
    try {
        const instances = await instanceManager.getAllInstances();
        res.json({ success: true, instances: instances });
    } catch (error) {
        console.error('Erro ao listar instâncias:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Obter instância específica
app.get('/api/instances/:instanceId', requireTokenAuth, async (req, res) => {
    try {
        const instance = await instanceManager.getInstance(req.params.instanceId);
        if (instance) {
            res.json({ success: true, instance: instance });
        } else {
            res.status(404).json({ success: false, error: 'Instância não encontrada' });
        }
    } catch (error) {
        console.error('Erro ao obter instância:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
});

// Criar nova instância
app.post('/api/instances', requireTokenAuth, async (req, res) => {
    try {
        const { name, username, password } = req.body;
        
        if (!name || !username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nome, username e senha são obrigatórios' 
            });
        }

        const instance = await instanceManager.createInstance(name, username, password);
        res.json({ success: true, instance: instance });
    } catch (error) {
        console.error('Erro ao criar instância:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Conectar instância
app.post('/api/instances/:instanceId/connect', requireTokenAuth, async (req, res) => {
    try {
        const { password } = req.body;
        const result = await instanceManager.connectInstance(req.params.instanceId, password);
        res.json(result);
    } catch (error) {
        console.error('Erro ao conectar instância:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Desconectar instância
app.post('/api/instances/:instanceId/disconnect', requireTokenAuth, async (req, res) => {
    try {
        const result = await instanceManager.disconnectInstance(req.params.instanceId);
        res.json(result);
    } catch (error) {
        console.error('Erro ao desconectar instância:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deletar instância
app.delete('/api/instances/:instanceId', requireTokenAuth, async (req, res) => {
    try {
        const result = await instanceManager.deleteInstance(req.params.instanceId);
        res.json(result);
    } catch (error) {
        console.error('Erro ao deletar instância:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Enviar mensagem
app.post('/api/instances/:instanceId/send-message', requireTokenAuth, async (req, res) => {
    try {
        const { recipient, message } = req.body;
        const result = await instanceManager.sendMessage(req.params.instanceId, recipient, message);
        res.json(result);
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter conversas
app.get('/api/instances/:instanceId/conversations', requireTokenAuth, async (req, res) => {
    try {
        const conversations = await instanceManager.getConversations(req.params.instanceId);
        res.json({ success: true, conversations: conversations });
    } catch (error) {
        console.error('Erro ao obter conversas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter mensagens de uma conversa
app.get('/api/instances/:instanceId/threads/:threadId/messages', requireTokenAuth, async (req, res) => {
    try {
        const messages = await instanceManager.getMessages(req.params.instanceId, req.params.threadId);
        res.json({ success: true, messages: messages });
    } catch (error) {
        console.error('Erro ao obter mensagens:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar usuário
app.get('/api/instances/:instanceId/search-user', requireTokenAuth, async (req, res) => {
    try {
        const { username } = req.query;
        const user = await instanceManager.searchUser(req.params.instanceId, username);
        res.json({ success: true, user: user });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter informações do usuário
app.get('/api/instances/:instanceId/user-info', requireTokenAuth, async (req, res) => {
    try {
        const { userId } = req.query;
        const userInfo = await instanceManager.getUserInfo(req.params.instanceId, userId);
        res.json({ success: true, userInfo: userInfo });
    } catch (error) {
        console.error('Erro ao obter informações do usuário:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter status da instância
app.get('/api/instances/:instanceId/status', requireTokenAuth, async (req, res) => {
    try {
        const status = await instanceManager.getInstanceStatus(req.params.instanceId);
        res.json({ success: true, status: status });
    } catch (error) {
        console.error('Erro ao obter status da instância:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter logs
app.get('/api/logs', requireTokenAuth, async (req, res) => {
    try {
        const { level, limit = 100 } = req.query;
        const logs = await database.getLogs(level, parseInt(limit));
        res.json({ success: true, logs: logs });
    } catch (error) {
        console.error('Erro ao obter logs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Instagram Manager rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`🔑 Token da API: ${process.env.API_TOKEN || 'instagram-manager-token'}`);
});

module.exports = app;