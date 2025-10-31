const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

/**
 * Configura proxy para o IgApiClient
 * Suporta HTTP, HTTPS e SOCKS5 proxies
 * 
 * Formatos suportados:
 * - http://host:port
 * - http://user:pass@host:port
 * - https://host:port
 * - socks5://host:port
 * - socks5://user:pass@host:port
 */
class ProxyConfig {
    static setupProxy(igClient, proxyUrl) {
        if (!proxyUrl || proxyUrl.trim() === '') {
            console.log('⚠️ Nenhum proxy configurado');
            return null;
        }

        try {
            const url = new URL(proxyUrl);
            let httpAgent, httpsAgent;

            console.log(`🔧 Configurando proxy: ${url.protocol}//${url.hostname}:${url.port || 'padrão'}`);

            // Configurar agente baseado no protocolo
            if (url.protocol === 'socks5:' || url.protocol === 'socks:') {
                // SOCKS proxy
                httpAgent = new SocksProxyAgent(proxyUrl);
                httpsAgent = new SocksProxyAgent(proxyUrl);
                console.log('✅ Proxy SOCKS5 configurado');
            } else if (url.protocol === 'http:' || url.protocol === 'https:') {
                // HTTP/HTTPS proxy
                httpAgent = new HttpProxyAgent(proxyUrl);
                httpsAgent = new HttpsProxyAgent(proxyUrl);
                console.log('✅ Proxy HTTP/HTTPS configurado');
            } else {
                console.warn('⚠️ Protocolo de proxy não suportado:', url.protocol);
                return null;
            }

            // Configurar o agente no cliente HTTP da biblioteca
            // A biblioteca instagram-private-api usa axios internamente
            // Tentamos múltiplas formas de configurar o proxy
            
            // Método 1: Via request defaults (padrão)
            if (igClient.request) {
                // Configurar agentes HTTP e HTTPS nos defaults
                if (igClient.request.defaults) {
                    igClient.request.defaults.httpAgent = httpAgent;
                    igClient.request.defaults.httpsAgent = httpsAgent;
                }
                
                // Tentar configurar via axios diretamente se disponível
                if (igClient.request.axiosInstance) {
                    igClient.request.axiosInstance.defaults.httpAgent = httpAgent;
                    igClient.request.axiosInstance.defaults.httpsAgent = httpsAgent;
                }
            }
            
            // Método 2: Via state.proxyUrl (método alternativo da biblioteca)
            if (igClient.state) {
                igClient.state.proxyUrl = proxyUrl;
            }
            
            // Método 3: Configurar globalmente se necessário
            // (algumas versões da biblioteca podem precisar disso)
            if (global.HTTP_PROXY === undefined && url.protocol.startsWith('http')) {
                global.HTTP_PROXY = proxyUrl;
                global.HTTPS_PROXY = proxyUrl;
            }

            return {
                httpAgent,
                httpsAgent,
                proxyUrl
            };
        } catch (error) {
            console.error('❌ Erro ao configurar proxy:', error.message);
            console.error('⚠️ Verifique se o formato do proxy está correto');
            return null;
        }
    }

    /**
     * Obtém configuração de proxy do ambiente
     * Verifica PROXY_URL ou PROXY_URLS (lista separada por vírgula para rotação)
     */
    static getProxyFromEnv() {
        const proxyUrl = process.env.PROXY_URL || null;
        
        if (proxyUrl) {
            return proxyUrl.trim();
        }

        // Se não houver PROXY_URL, verificar PROXY_URLS para rotação
        const proxyUrls = process.env.PROXY_URLS || null;
        if (proxyUrls) {
            const proxies = proxyUrls.split(',').map(p => p.trim()).filter(p => p);
            if (proxies.length > 0) {
                // Rotacionar proxies - pegar um aleatório
                const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
                console.log(`🔄 Usando proxy rotacionado: ${randomProxy.substring(0, 20)}...`);
                return randomProxy;
            }
        }

        return null;
    }

    /**
     * Testa se o proxy está funcionando
     */
    static async testProxy(proxyUrl) {
        try {
            const https = require('https');
            const agent = new HttpsProxyAgent(proxyUrl);
            
            return new Promise((resolve, reject) => {
                const req = https.get({
                    hostname: 'api.instagram.com',
                    path: '/',
                    agent: agent,
                    timeout: 10000
                }, (res) => {
                    resolve(true);
                });

                req.on('error', (error) => {
                    reject(error);
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Timeout ao testar proxy'));
                });
            });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = ProxyConfig;
