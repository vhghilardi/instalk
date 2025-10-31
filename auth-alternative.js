const { IgApiClient } = require('instagram-private-api');
const fs = require('fs');
const path = require('path');
const ProxyConfig = require('./proxyConfig');
const InternalProxy = require('./internalProxy');

class InstagramAuthAlternative {
    constructor(options = {}) {
        this.ig = new IgApiClient();
        this.sessionFile = path.join(__dirname, 'session.json');
        this.options = options;
        this.setupAntiDetection();
    }

    setupAntiDetection() {
        // Configurar proxy externo primeiro (se disponível)
        const proxyUrl = ProxyConfig.getProxyFromEnv();
        if (proxyUrl) {
            ProxyConfig.setupProxy(this.ig, proxyUrl);
        }

        // Configurar proxy interno (simulação de proxy sem servidor)
        const useInternalProxy = process.env.USE_INTERNAL_PROXY !== 'false';
        if (useInternalProxy) {
            this.internalProxy = new InternalProxy(this.ig, {
                maxRetries: parseInt(process.env.INTERNAL_PROXY_MAX_RETRIES || '3'),
                retryDelay: parseInt(process.env.INTERNAL_PROXY_RETRY_DELAY || '2000'),
                requestsPerMinute: parseInt(process.env.INTERNAL_PROXY_REQ_PER_MIN || '30'),
                requestsPerHour: parseInt(process.env.INTERNAL_PROXY_REQ_PER_HOUR || '1000'),
                enableCache: process.env.INTERNAL_PROXY_CACHE !== 'false',
                enableLogging: process.env.INTERNAL_PROXY_LOGGING !== 'false',
                ...this.options.internalProxy
            });
            console.log('✅ Proxy interno configurado');
        }

        // Configurar como um dispositivo "antigo" e confiável
        const deviceId = this.generateConsistentDeviceId();
        
        // Simular um dispositivo que já foi usado antes
        this.ig.state.deviceString = deviceId;
        this.ig.state.deviceId = deviceId;
        this.ig.state.uuid = this.generateUUID();
        this.ig.state.phoneId = this.generatePhoneId();
        this.ig.state.adid = this.generateAdId();
        
        // Headers para parecer um app antigo e confiável
        this.ig.request.defaults.headers = {
            ...this.ig.request.defaults.headers,
            'User-Agent': 'Instagram 185.0.0.34.123 Android (28/9.0; 420dpi; 1080x2160; samsung; SM-G960F; starlte; samsungexynos9810; pt_BR; 279865275)',
            'X-IG-App-ID': '567067343352427',
            'X-IG-Device-ID': deviceId,
            'X-IG-Android-ID': this.generateAndroidId(),
        };
    }

    generateConsistentDeviceId() {
        // Gerar um device ID consistente baseado em uma seed
        const seed = 'instagram-app-device-2023';
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    generatePhoneId() {
        return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, function() {
            return (Math.random() * 16 | 0).toString(16);
        });
    }

    generateAdId() {
        return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, function() {
            return (Math.random() * 16 | 0).toString(16);
        });
    }

    generateAndroidId() {
        return Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }

    async login(username, password) {
        try {
            // Verificar sessão existente
            if (fs.existsSync(this.sessionFile)) {
                console.log('Tentando usar sessão existente...');
                try {
                    const sessionData = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
                    await this.ig.state.deserialize(sessionData);
                    await this.ig.account.currentUser();
                    console.log('✅ Sessão válida encontrada!');
                    return { success: true };
                } catch (error) {
                    console.log('❌ Sessão inválida, removendo...');
                    fs.unlinkSync(this.sessionFile);
                }
            }

            console.log('🔄 Iniciando processo de login alternativo...');
            
            // Método 1: Login direto sem simulações
            try {
                console.log('Tentativa 1: Login direto...');
                await this.directLogin(username, password);
                return { success: true };
            } catch (error) {
                console.log('Tentativa 1 falhou:', error.message);
            }

            // Aguardar antes da próxima tentativa
            await this.sleep(3000);

            // Método 2: Login com device "envelhecido"
            try {
                console.log('Tentativa 2: Login com device envelhecido...');
                await this.agedDeviceLogin(username, password);
                return { success: true };
            } catch (error) {
                console.log('Tentativa 2 falhou:', error.message);
            }

            // Aguardar antes da próxima tentativa
            await this.sleep(5000);

            // Método 3: Login com headers mínimos
            try {
                console.log('Tentativa 3: Login com headers mínimos...');
                await this.minimalLogin(username, password);
                return { success: true };
            } catch (error) {
                console.log('Tentativa 3 falhou:', error.message);
                return this.handleError(error);
            }

        } catch (error) {
            return this.handleError(error);
        }
    }

    async directLogin(username, password) {
        this.ig.state.generateDevice(username);
        const result = await this.ig.account.login(username, password);
        await this.saveSession();
        return result;
    }

    async agedDeviceLogin(username, password) {
        // Simular um dispositivo que já foi usado há meses
        this.ig.state.generateDevice(username);
        
        // Adicionar "histórico" ao dispositivo
        this.ig.state.constants.APP_VERSION = '185.0.0.34.123'; // Versão mais antiga
        this.ig.state.constants.APP_VERSION_CODE = '279865275';
        
        // Aguardar para simular "pensamento"
        await this.sleep(2000);
        
        const result = await this.ig.account.login(username, password);
        await this.saveSession();
        return result;
    }

    async minimalLogin(username, password) {
        // Resetar headers para o mínimo necessário
        this.ig.request.defaults.headers = {
            'User-Agent': 'Instagram 185.0.0.34.123 Android',
            'Accept': '*/*',
            'Accept-Language': 'pt-BR',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        };

        this.ig.state.generateDevice(username);
        const result = await this.ig.account.login(username, password);
        await this.saveSession();
        return result;
    }

    async saveSession() {
        const sessionData = await this.ig.state.serialize();
        fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData));
        console.log('✅ Sessão salva com sucesso!');
    }

    handleError(error) {
        console.error('❌ Erro no login:', error.message);
        
        if (error.message.includes('challenge_required')) {
            return {
                success: false,
                error: 'challenge_required',
                message: `🚫 CHALLENGE DETECTADO!
                
📋 SOLUÇÕES POSSÍVEIS:

1️⃣ MÉTODO PRINCIPAL (Mais eficaz):
   • Abra o Instagram no celular
   • Faça login normalmente
   • Use por 5-10 minutos (veja stories, posts)
   • Aguarde 30-60 minutos
   • Tente novamente aqui

2️⃣ MÉTODO ALTERNATIVO:
   • Acesse instagram.com no navegador
   • Faça login e complete verificações
   • Aguarde 15-30 minutos
   • Tente novamente

3️⃣ ÚLTIMA OPÇÃO:
   • Crie uma conta nova só para testes
   • Use ela por alguns dias normalmente
   • Depois teste com esta aplicação

⚠️ IMPORTANTE: Este erro é comum com APIs não-oficiais!`
            };
        }

        if (error.message.includes('checkpoint_required')) {
            return {
                success: false,
                error: 'checkpoint_required',
                message: 'Sua conta precisa de verificação. Acesse instagram.com e complete a verificação.'
            };
        }

        if (error.message.includes('Please wait')) {
            return {
                success: false,
                error: 'rate_limit',
                message: 'Muitas tentativas. Aguarde 30-60 minutos antes de tentar novamente.'
            };
        }

        return {
            success: false,
            error: 'unknown',
            message: error.message
        };
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getIgClient() {
        return this.ig;
    }

    async logout() {
        try {
            await this.ig.account.logout();
            if (fs.existsSync(this.sessionFile)) {
                fs.unlinkSync(this.sessionFile);
            }
            console.log('✅ Logout realizado com sucesso!');
        } catch (error) {
            console.error('❌ Erro no logout:', error.message);
        }
    }

    async isLoggedIn() {
        try {
            await this.ig.account.currentUser();
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = InstagramAuthAlternative;

