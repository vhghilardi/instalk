/**
 * Proxy Interno para IgApiClient
 * 
 * Funcionalidades:
 * - Retry automático com backoff exponencial
 * - Rate limiting por instância
 * - Cache de respostas
 * - Delays inteligentes entre requisições
 * - Modificação de headers para evitar detecção
 * - Rotação de user-agents
 * - Logging detalhado
 * - Análise de erros e tratamento inteligente
 */

class InternalProxy {
    constructor(igClient, options = {}) {
        this.ig = igClient;
        this.options = {
            // Retry
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 2000,
            retryBackoff: options.retryBackoff || 2,
            
            // Rate Limiting
            requestsPerMinute: options.requestsPerMinute || 30,
            requestsPerHour: options.requestsPerHour || 1000,
            
            // Delays
            minDelay: options.minDelay || 1000,
            maxDelay: options.maxDelay || 3000,
            enableRandomDelays: options.enableRandomDelays !== false,
            
            // Cache
            enableCache: options.enableCache !== false,
            cacheTTL: options.cacheTTL || 300000, // 5 minutos
            
            // Headers
            rotateUserAgents: options.rotateUserAgents !== false,
            
            // Logging
            enableLogging: options.enableLogging !== false,
            
            ...options
        };
        
        // Estado interno
        this.requestHistory = [];
        this.cache = new Map();
        this.userAgents = [
            'Instagram 239.0.0.10.109 Android (29/10; 420dpi; 1080x2220; samsung; SM-G973F; beyond1; exynos9820; pt_BR; 382468104)',
            'Instagram 239.0.0.10.109 Android (29/10; 420dpi; 1080x2220; samsung; SM-G970F; beyond0; exynos9820; pt_BR; 382468104)',
            'Instagram 185.0.0.34.123 Android (28/9.0; 420dpi; 1080x2160; samsung; SM-G960F; starlte; samsungexynos9810; pt_BR; 279865275)',
            'Instagram 183.0.0.21.120 Android (28/9.0; 420dpi; 1080x2160; samsung; SM-G950F; dreamlte; samsungexynos8895; pt_BR; 275532272)',
        ];
        
        // Interceptar requisições do cliente
        this.interceptRequests();
    }
    
    /**
     * Intercepta as requisições do IgApiClient
     * Tenta múltiplas formas de interceptação para compatibilidade
     */
    interceptRequests() {
        if (!this.ig.request) {
            this.log('⚠️ IgApiClient.request não disponível para interceptação');
            return;
        }
        
        const self = this;
        
        // Interceptar método end() (mais comum)
        if (typeof this.ig.request.end === 'function') {
            const originalEnd = this.ig.request.end;
            this.ig.request.end = function(...args) {
                return self.wrapRequest(originalEnd.bind(this), args);
            };
        }
        
        // Interceptar método send() se disponível
        if (typeof this.ig.request.send === 'function') {
            const originalSend = this.ig.request.send;
            this.ig.request.send = function(...args) {
                return self.wrapRequest(originalSend.bind(this), args);
            };
        }
        
        // Interceptar via axios se disponível
        if (this.ig.request.axiosInstance) {
            const axios = this.ig.request.axiosInstance;
            
            // Interceptar requests do axios
            axios.interceptors.request.use(
                async (config) => {
                    await self.beforeRequest(config);
                    return config;
                },
                (error) => {
                    self.log(`❌ Erro no interceptor de requisição: ${error.message}`);
                    return Promise.reject(error);
                }
            );
            
            axios.interceptors.response.use(
                (response) => {
                    self.afterRequest(response);
                    return response;
                },
                async (error) => {
                    if (error.response || error.request) {
                        return await self.handleErrorResponse(error, axios, error.config);
                    }
                    return Promise.reject(error);
                }
            );
        }
        
        this.log('✅ Interceptação de requisições configurada');
    }
    
    /**
     * Wrapper para métodos de requisição
     */
    async wrapRequest(originalFunction, args) {
        const requestId = this.generateRequestId();
        const startTime = Date.now();
        
        try {
            // Preparar antes da requisição
            await this.beforeRequestWrapper();
            
            // Executar requisição com retry
            const result = await this.executeWithRetry(originalFunction, args, requestId);
            
            // Registrar sucesso
            this.recordSuccess(startTime);
            
            this.log(`✅ Requisição ${requestId} completada em ${Date.now() - startTime}ms`);
            
            return result;
            
        } catch (error) {
            this.log(`❌ Erro na requisição ${requestId}: ${error.message}`);
            this.recordError(error);
            throw error;
        }
    }
    
    /**
     * Preparação antes da requisição (para interceptação via wrapper)
     */
    async beforeRequestWrapper() {
        // Verificar cache (será implementado na camada de resposta)
        // Rate limiting
        await this.checkRateLimit();
        
        // Delay inteligente
        if (this.options.enableRandomDelays) {
            await this.smartDelay();
        }
        
        // Melhorar headers
        this.enhanceHeaders();
    }
    
    /**
     * Preparação antes da requisição (para interceptação via axios)
     */
    async beforeRequest(config) {
        await this.beforeRequestWrapper();
        
        // Verificar cache por URL
        if (this.options.enableCache && config.url) {
            const cacheKey = this.generateCacheKey([config.url, config.method, config.data]);
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.options.cacheTTL) {
                // Retornar resposta cached (será interceptado no response)
                config._fromCache = true;
                config._cacheKey = cacheKey;
            }
        }
        
        return config;
    }
    
    /**
     * Processamento após requisição bem-sucedida (axios)
     */
    afterRequest(response) {
        // Atualizar cache se necessário
        if (this.options.enableCache && response.config && response.config.url) {
            const cacheKey = this.generateCacheKey([
                response.config.url,
                response.config.method,
                response.config.data
            ]);
            this.cache.set(cacheKey, {
                data: response,
                timestamp: Date.now()
            });
        }
        
        this.recordSuccess(Date.now());
    }
    
    /**
     * Tratamento de erro na resposta (axios)
     */
    async handleErrorResponse(error, axios, originalConfig) {
        this.recordError(error);
        
        // Retry automático para erros recuperáveis
        const config = error.config || originalConfig;
        
        if (config && this.shouldRetryError(error) && this.canRetry()) {
            const retryCount = config._retryCount || 0;
            
            if (retryCount < this.options.maxRetries) {
                config._retryCount = retryCount + 1;
                const delay = this.options.retryDelay * Math.pow(this.options.retryBackoff, retryCount);
                
                this.log(`🔄 Retry ${retryCount + 1}/${this.options.maxRetries} após ${delay}ms`);
                await this.delay(delay);
                
                // Tentar novamente
                return axios.request(config);
            }
        }
        
        return Promise.reject(error);
    }
    
    
    /**
     * Executa requisição com retry automático
     */
    async executeWithRetry(originalFunction, args, requestId) {
        let lastError;
        
        for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = this.options.retryDelay * Math.pow(this.options.retryBackoff, attempt - 1);
                    this.log(`🔄 Retry ${attempt}/${this.options.maxRetries} para ${requestId} após ${delay}ms`);
                    await this.delay(delay);
                }
                
                return await originalFunction(...args);
                
            } catch (error) {
                lastError = error;
                
                // Se é erro que não deve retentar, lança imediatamente
                if (!this.shouldRetryError(error)) {
                    throw error;
                }
                
                // Se é último attempt, lança o erro
                if (attempt === this.options.maxRetries) {
                    break;
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Verifica se deve retentar baseado no erro
     */
    shouldRetryError(error) {
        const retryableErrors = [
            'ETIMEDOUT',
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'timeout',
            'Network Error',
            '500',
            '502',
            '503',
            '504'
        ];
        
        const errorStr = error.message || error.toString();
        return retryableErrors.some(err => errorStr.includes(err));
    }
    
    /**
     * Verifica rate limiting
     */
    async checkRateLimit() {
        const now = Date.now();
        
        // Limpar histórico antigo
        this.requestHistory = this.requestHistory.filter(
            time => now - time < 3600000 // última hora
        );
        
        // Verificar limite por hora
        if (this.requestHistory.length >= this.options.requestsPerHour) {
            const oldest = this.requestHistory[0];
            const waitTime = 3600000 - (now - oldest);
            if (waitTime > 0) {
                this.log(`⏳ Rate limit: aguardando ${Math.ceil(waitTime / 1000)}s`);
                await this.delay(waitTime);
            }
        }
        
        // Verificar limite por minuto
        const recentRequests = this.requestHistory.filter(
            time => now - time < 60000 // último minuto
        );
        
        if (recentRequests.length >= this.options.requestsPerMinute) {
            const oldestRecent = recentRequests[0];
            const waitTime = 60000 - (now - oldestRecent);
            if (waitTime > 0) {
                this.log(`⏳ Rate limit por minuto: aguardando ${Math.ceil(waitTime / 1000)}s`);
                await this.delay(waitTime);
            }
        }
    }
    
    /**
     * Delay inteligente entre requisições
     */
    async smartDelay() {
        // Calcular delay baseado no histórico
        const recentCount = this.requestHistory.filter(
            time => Date.now() - time < 10000 // últimos 10 segundos
        ).length;
        
        // Aumentar delay se muitas requisições recentes
        const baseDelay = this.options.minDelay;
        const maxDelay = this.options.maxDelay;
        const multiplier = Math.min(recentCount * 0.2, 2);
        
        const delay = Math.min(
            baseDelay * (1 + multiplier),
            maxDelay
        );
        
        // Adicionar variação aleatória
        const randomVariation = (Math.random() - 0.5) * delay * 0.3;
        const finalDelay = Math.max(0, delay + randomVariation);
        
        if (finalDelay > 100) {
            await this.delay(finalDelay);
        }
    }
    
    /**
     * Melhora os headers antes da requisição
     */
    enhanceHeaders() {
        if (!this.ig.request || !this.ig.request.defaults) return;
        
        const headers = this.ig.request.defaults.headers || {};
        
        // Rotacionar user-agent se habilitado
        if (this.options.rotateUserAgents && this.userAgents.length > 0) {
            const randomUA = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
            headers['User-Agent'] = randomUA;
        }
        
        // Adicionar headers de banda para parecer mais realista
        if (!headers['X-IG-Bandwidth-Speed-KBPS']) {
            headers['X-IG-Bandwidth-Speed-KBPS'] = Math.floor(Math.random() * 5000 + 1000).toString();
            headers['X-IG-Bandwidth-TotalBytes-B'] = Math.floor(Math.random() * 50000000 + 10000000).toString();
            headers['X-IG-Bandwidth-TotalTime-MS'] = Math.floor(Math.random() * 3000 + 500).toString();
        }
        
        // Atualizar timestamp
        headers['X-Pigeon-Rawclienttime'] = (Date.now() / 1000).toFixed(3);
        
        this.ig.request.defaults.headers = headers;
    }
    
    /**
     * Gerencia cache
     */
    checkCache(requestId, args) {
        const cacheKey = this.generateCacheKey(args);
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.options.cacheTTL) {
            return cached.data;
        }
        
        if (cached) {
            this.cache.delete(cacheKey);
        }
        
        return null;
    }
    
    updateCache(requestId, args, data) {
        const cacheKey = this.generateCacheKey(args);
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        
        // Limpar cache antigo periodicamente
        if (this.cache.size > 100) {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp > this.options.cacheTTL * 2) {
                    this.cache.delete(key);
                }
            }
        }
    }
    
    generateCacheKey(args) {
        // Gerar chave baseada nos argumentos da requisição
        try {
            const argStr = JSON.stringify(args);
            return require('crypto').createHash('md5').update(argStr).digest('hex');
        } catch (error) {
            return Date.now().toString();
        }
    }
    
    /**
     * Registra sucesso de requisição
     */
    recordSuccess(startTime) {
        const now = Date.now();
        this.requestHistory.push(now);
    }
    
    /**
     * Registra erro
     */
    recordError(error) {
        // Pode adicionar lógica para análise de padrões de erro
        const errorCount = (this.errorHistory = this.errorHistory || []).length;
        this.errorHistory.push({
            error: error.message,
            timestamp: Date.now()
        });
        
        // Manter apenas últimos 100 erros
        if (this.errorHistory.length > 100) {
            this.errorHistory.shift();
        }
    }
    
    /**
     * Verifica se pode tentar novamente baseado no histórico de erros
     */
    canRetry() {
        if (!this.errorHistory || this.errorHistory.length === 0) {
            return true;
        }
        
        const recentErrors = this.errorHistory.filter(
            err => Date.now() - err.timestamp < 60000 // última minuto
        );
        
        // Se muitos erros recentes, aguardar mais
        return recentErrors.length < 10;
    }
    
    /**
     * Utilitários
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    
    log(message) {
        if (this.options.enableLogging) {
            console.log(`[InternalProxy] ${message}`);
        }
    }
    
    /**
     * Estatísticas do proxy
     */
    getStats() {
        return {
            totalRequests: this.requestHistory.length,
            recentRequests: this.requestHistory.filter(
                time => Date.now() - time < 60000
            ).length,
            cacheSize: this.cache.size,
            errors: this.errorHistory ? this.errorHistory.length : 0
        };
    }
    
    /**
     * Limpar cache e histórico
     */
    clearCache() {
        this.cache.clear();
        this.log('🗑️ Cache limpo');
    }
    
    clearHistory() {
        this.requestHistory = [];
        this.errorHistory = [];
        this.log('🗑️ Histórico limpo');
    }
}

module.exports = InternalProxy;
