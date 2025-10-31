const { IgApiClient } = require('instagram-private-api');
const fs = require('fs');
const path = require('path');
const ProxyConfig = require('./proxyConfig');
const InternalProxy = require('./internalProxy');

class InstagramAuth {
    constructor(options = {}) {
        this.ig = new IgApiClient();
        this.sessionFile = path.join(__dirname, 'session.json');
        this.options = options;
        this.setupAdvancedConfig();
    }

    setupAdvancedConfig() {
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
        
        // Simular um dispositivo Android mais realista
        this.ig.state.constants = {
            ...this.ig.state.constants,
            USER_AGENT: 'Instagram 239.0.0.10.109 Android (29/10; 420dpi; 1080x2220; samsung; SM-G973F; beyond1; exynos9820; pt_BR; 382468104)',
            APP_VERSION: '239.0.0.10.109',
            APP_VERSION_CODE: '382468104',
            EXPERIMENTS: this.getRealisticExperiments()
        };
    }

    getRealisticExperiments() {
        return [
            'ig_android_profile_contextual_config',
            'ig_android_camera_nux',
            'ig_android_device_detection_info_upload',
            'ig_android_gmail_oauth_in_reg',
            'ig_android_device_verification_fb_signup',
            'ig_android_passwordless_account_password_creation_universe'
        ].join(',');
    }

    async login(username, password) {
        try {
            // Tentar carregar sessão existente primeiro
            if (fs.existsSync(this.sessionFile)) {
                console.log('Carregando sessão existente...');
                const sessionData = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
                await this.ig.state.deserialize(sessionData);
                
                // Verificar se a sessão ainda é válida
                try {
                    await this.ig.account.currentUser();
                    console.log('Sessão válida encontrada!');
                    return { success: true };
                } catch (error) {
                    console.log('Sessão expirada, fazendo login novamente...');
                    // Limpar sessão inválida
                    if (fs.existsSync(this.sessionFile)) {
                        fs.unlinkSync(this.sessionFile);
                    }
                }
            }

            // Configurar dispositivo de forma mais realista
            await this.setupRealisticDevice(username);
            
            // Aguardar um pouco para simular comportamento humano
            await this.humanDelay(2000, 4000);
            
            // Tentar múltiplas estratégias de login
            return await this.attemptLoginWithStrategies(username, password);
            
        } catch (error) {
            console.error('Erro no login:', error.message);
            return this.handleLoginError(error);
        }
    }

    async setupRealisticDevice(username) {
        // Gerar dispositivo com seed baseado no username para consistência
        this.ig.state.generateDevice(username);
        
        // Configurar headers mais realistas
        this.ig.request.defaults.headers = {
            ...this.ig.request.defaults.headers,
            'X-IG-App-Locale': 'pt_BR',
            'X-IG-Device-Locale': 'pt_BR',
            'X-IG-Mapped-Locale': 'pt_BR',
            'X-Pigeon-Session-Id': this.generateSessionId(),
            'X-Pigeon-Rawclienttime': (Date.now() / 1000).toFixed(3),
            'X-IG-Bandwidth-Speed-KBPS': Math.floor(Math.random() * 5000 + 1000).toString(),
            'X-IG-Bandwidth-TotalBytes-B': Math.floor(Math.random() * 50000000 + 10000000).toString(),
            'X-IG-Bandwidth-TotalTime-MS': Math.floor(Math.random() * 3000 + 500).toString()
        };
    }

    async attemptLoginWithStrategies(username, password) {
        const strategies = [
            () => this.loginWithMinimalFlow(username, password),
            () => this.loginWithFullFlow(username, password),
            () => this.loginWithDelayedFlow(username, password)
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                console.log(`Tentativa ${i + 1} de login...`);
                const result = await strategies[i]();
                
                if (result.success) {
                    // Salvar sessão
                    const sessionData = await this.ig.state.serialize();
                    fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData));
                    console.log('Login realizado com sucesso!');
                    return result;
                }
            } catch (error) {
                console.log(`Estratégia ${i + 1} falhou:`, error.message);
                
                if (error.message.includes('challenge_required')) {
                    return this.handleLoginError(error);
                }
                
                // Aguardar antes da próxima tentativa
                if (i < strategies.length - 1) {
                    await this.humanDelay(5000, 10000);
                }
            }
        }

        throw new Error('Todas as estratégias de login falharam');
    }

    async loginWithMinimalFlow(username, password) {
        console.log('Usando fluxo mínimo...');
        const loginResult = await this.ig.account.login(username, password);
        return { success: true, user: loginResult };
    }

    async loginWithFullFlow(username, password) {
        console.log('Usando fluxo completo...');
        
        // Pre-login flow
        await this.ig.simulate.preLoginFlow();
        await this.humanDelay(1000, 3000);
        
        // Login
        const loginResult = await this.ig.account.login(username, password);
        
        // Post-login flow (não aguardar para não bloquear)
        setTimeout(async () => {
            try {
                await this.ig.simulate.postLoginFlow();
            } catch (error) {
                console.log('Erro no pós-login flow:', error.message);
            }
        }, 5000);
        
        return { success: true, user: loginResult };
    }

    async loginWithDelayedFlow(username, password) {
        console.log('Usando fluxo com delays...');
        
        // Simular abertura do app
        await this.humanDelay(2000, 4000);
        
        // Simular digitação do username
        await this.humanDelay(1000, 2000);
        
        // Simular digitação da senha
        await this.humanDelay(1000, 2000);
        
        // Login
        const loginResult = await this.ig.account.login(username, password);
        
        return { success: true, user: loginResult };
    }

    generateSessionId() {
        return 'UFS-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
    }

    async humanDelay(min = 1000, max = 3000) {
        const delay = Math.random() * (max - min) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    handleLoginError(error) {
        if (error.message.includes('challenge_required')) {
            return { 
                success: false, 
                error: 'challenge_required',
                message: 'Instagram detectou atividade suspeita. Soluções:\n1. Use o app oficial por alguns minutos\n2. Aguarde 30-60 minutos\n3. Tente usar um proxy/VPN diferente\n4. Considere criar uma conta nova para testes'
            };
        } else if (error.message.includes('checkpoint_required')) {
            return { 
                success: false, 
                error: 'checkpoint_required',
                message: 'Sua conta precisa de verificação. Acesse instagram.com e complete a verificação.'
            };
        } else if (error.message.includes('Please wait a few minutes')) {
            return { 
                success: false, 
                error: 'rate_limit',
                message: 'Muitas tentativas de login. Aguarde pelo menos 15-30 minutos.'
            };
        } else if (error.message.includes('The username you entered')) {
            return { 
                success: false, 
                error: 'invalid_credentials',
                message: 'Usuário ou senha incorretos.'
            };
        } else {
            return { 
                success: false, 
                error: 'unknown',
                message: error.message
            };
        }
    }

    async randomDelay() {
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    async logout() {
        try {
            await this.ig.account.logout();
            if (fs.existsSync(this.sessionFile)) {
                fs.unlinkSync(this.sessionFile);
            }
            console.log('Logout realizado com sucesso!');
        } catch (error) {
            console.error('Erro no logout:', error.message);
        }
    }

    getIgClient() {
        return this.ig;
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

module.exports = InstagramAuth;
